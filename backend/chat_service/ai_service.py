"""
AI Service - Integration with OpenAI GPT for chat assistant
"""
import os
import logging
from typing import Dict, Any, Optional, List
from datetime import datetime

try:
    import openai
    OPENAI_AVAILABLE = True
except ImportError:
    OPENAI_AVAILABLE = False
    openai = None

logger = logging.getLogger(__name__)


class AIService:
    """
    AI Assistant service using OpenAI GPT
    Provides intelligent responses for customer support and technician assistance
    """
    
    def __init__(self):
        # Get OpenAI API key from environment
        self.api_key = os.getenv("OPENAI_API_KEY")
        
        if self.api_key and OPENAI_AVAILABLE:
            openai.api_key = self.api_key
            self.enabled = True
            logger.info("AI Service initialized with OpenAI API")
        else:
            self.enabled = False
            if not OPENAI_AVAILABLE:
                logger.warning("OpenAI package not installed. AI Service will use fallback responses.")
            else:
                logger.warning("OPENAI_API_KEY not found. AI Service will use fallback responses.")
        
        # System prompts for different contexts
        self.system_prompts = {
            "customer_support": """Bạn là trợ lý AI cho dịch vụ bảo dưỡng xe điện EV Service Center.
            Nhiệm vụ của bạn là hỗ trợ khách hàng với các câu hỏi về:
            - Dịch vụ bảo dưỡng xe điện
            - Đặt lịch hẹn
            - Giá cả và gói dịch vụ
            - Tình trạng xe và sửa chữa
            Hãy trả lời một cách chuyên nghiệp, thân thiện và hữu ích.""",
            
            "technician": """Bạn là trợ lý kỹ thuật AI cho kỹ thuật viên EV Service Center.
            Nhiệm vụ của bạn là hỗ trợ kỹ thuật viên với:
            - Tra cứu mã lỗi xe điện
            - Hướng dẫn quy trình bảo dưỡng
            - Giải đáp vấn đề kỹ thuật
            - Cung cấp thông tin về phụ tùng
            Hãy trả lời chính xác, chi tiết và dễ hiểu.""",
            
            "general": """Bạn là trợ lý AI thông minh của EV Service Center.
            Hãy cung cấp thông tin chính xác và hữu ích cho người dùng."""
        }
        
        # Conversation history cache (session_id -> messages)
        self.conversation_history: Dict[str, List[Dict]] = {}
    
    async def get_response(
        self,
        message: str,
        session_id: Optional[str] = None,
        user_context: Optional[Dict] = None,
        context: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Get AI response for a message
        
        Args:
            message: User's message
            session_id: Chat session ID for context
            user_context: User information (role, id, etc.)
            context: Additional context data
        
        Returns:
            Dict with response content and metadata
        """
        try:
            # Determine system prompt based on user type
            user_role = user_context.get('role', 'customer') if user_context else 'customer'
            
            if user_role in ['technician', 'staff']:
                system_prompt = self.system_prompts['technician']
            else:
                system_prompt = self.system_prompts['customer_support']
            
            # Get or initialize conversation history
            if session_id:
                if session_id not in self.conversation_history:
                    self.conversation_history[session_id] = []
                history = self.conversation_history[session_id]
            else:
                history = []
            
            # Add context information to message if available
            enhanced_message = message
            if context:
                context_info = []
                if 'vehicle_info' in context:
                    context_info.append(f"Thông tin xe: {context['vehicle_info']}")
                if 'service_type' in context:
                    context_info.append(f"Loại dịch vụ: {context['service_type']}")
                if 'error_code' in context:
                    context_info.append(f"Mã lỗi: {context['error_code']}")
                
                if context_info:
                    enhanced_message = f"{message}\n\nThông tin bổ sung:\n" + "\n".join(context_info)
            
            # Use OpenAI API if enabled
            if self.enabled:
                response = await self._get_openai_response(
                    system_prompt=system_prompt,
                    message=enhanced_message,
                    history=history
                )
            else:
                # Fallback response when OpenAI is not available
                response = self._get_fallback_response(message, user_role)
            
            # Update conversation history
            if session_id:
                history.append({"role": "user", "content": message})
                history.append({"role": "assistant", "content": response['content']})
                
                # Limit history to last 20 messages
                if len(history) > 20:
                    self.conversation_history[session_id] = history[-20:]
            
            return response
            
        except Exception as e:
            logger.error(f"Error getting AI response: {str(e)}")
            return {
                "content": "Xin lỗi, tôi gặp sự cố khi xử lý yêu cầu của bạn. Vui lòng thử lại sau.",
                "error": str(e),
                "metadata": {"error": True}
            }
    
    async def _get_openai_response(
        self,
        system_prompt: str,
        message: str,
        history: List[Dict]
    ) -> Dict[str, Any]:
        """
        Get response from OpenAI GPT API
        """
        try:
            # Build messages array
            messages = [{"role": "system", "content": system_prompt}]
            
            # Add conversation history
            messages.extend(history[-10:])  # Last 10 messages for context
            
            # Add current message
            messages.append({"role": "user", "content": message})
            
            # Call OpenAI API
            response = await openai.ChatCompletion.acreate(
                model="gpt-3.5-turbo",  # or "gpt-4" for better quality
                messages=messages,
                temperature=0.7,
                max_tokens=500,
                top_p=1.0,
                frequency_penalty=0.0,
                presence_penalty=0.0
            )
            
            # Extract response
            ai_message = response.choices[0].message.content
            
            return {
                "content": ai_message,
                "confidence": 0.9,
                "suggestions": [],
                "metadata": {
                    "model": response.model,
                    "tokens": response.usage.total_tokens,
                    "timestamp": datetime.now().isoformat()
                }
            }
            
        except Exception as e:
            logger.error(f"OpenAI API error: {str(e)}")
            raise
    
    def _get_fallback_response(self, message: str, user_role: str) -> Dict[str, Any]:
        """
        Fallback response when OpenAI is not available
        Simple keyword-based responses
        """
        message_lower = message.lower()
        
        # Customer support responses
        if user_role == 'customer':
            if any(word in message_lower for word in ['đặt lịch', 'book', 'hẹn']):
                return {
                    "content": "Để đặt lịch hẹn, bạn có thể sử dụng tính năng Đặt lịch trên trang web hoặc liên hệ hotline của chúng tôi. Bạn muốn đặt lịch cho dịch vụ nào?",
                    "suggestions": ["Bảo dưỡng định kỳ", "Sửa chữa", "Kiểm tra tổng quát"]
                }
            elif any(word in message_lower for word in ['giá', 'price', 'chi phí']):
                return {
                    "content": "Giá dịch vụ phụ thuộc vào loại xe và gói dịch vụ bạn chọn. Bạn có thể xem bảng giá chi tiết tại mục Dịch vụ hoặc cho tôi biết loại xe của bạn để tư vấn cụ thể hơn.",
                    "suggestions": ["Xem bảng giá", "Tư vấn dịch vụ"]
                }
        
        # Technician support responses
        elif user_role in ['technician', 'staff']:
            if any(word in message_lower for word in ['mã lỗi', 'error code', 'p0', 'p1', 'c0']):
                return {
                    "content": "Để tra cứu mã lỗi, vui lòng cung cấp mã cụ thể (ví dụ: P0A0F, C1234). Tôi sẽ cung cấp thông tin chi tiết về nguyên nhân và cách khắc phục.",
                    "suggestions": ["Tra cứu mã lỗi", "Hướng dẫn chẩn đoán"]
                }
            elif any(word in message_lower for word in ['quy trình', 'procedure', 'hướng dẫn']):
                return {
                    "content": "Vui lòng cho biết quy trình cụ thể bạn cần hướng dẫn (ví dụ: thay pin, kiểm tra động cơ, bảo dưỡng phanh). Tôi sẽ cung cấp hướng dẫn chi tiết.",
                    "suggestions": ["Quy trình bảo dưỡng pin", "Kiểm tra hệ thống điện"]
                }
        
        # Default response
        return {
            "content": "Cảm ơn bạn đã liên hệ. Tôi đã ghi nhận yêu cầu của bạn. Một nhân viên sẽ hỗ trợ bạn trong thời gian sớm nhất. Bạn còn câu hỏi gì khác không?",
            "suggestions": ["Đặt lịch hẹn", "Xem dịch vụ", "Liên hệ hotline"],
            "metadata": {"fallback": True}
        }
    
    def clear_history(self, session_id: str):
        """Clear conversation history for a session"""
        if session_id in self.conversation_history:
            del self.conversation_history[session_id]

import hashlib
import hmac
import urllib.parse

class VNPay:
    def __init__(self):
        self.requestData = {}
        self.responseData = {}

    def get_payment_url(self, vnpay_payment_url, secret_key):
        """
        Tạo URL thanh toán VNPay với signature HMAC-SHA512
        """
        inputData = sorted(self.requestData.items())
        queryString = ''
        hasData = ''
        seq = 0
        for key, val in inputData:
            if seq == 1:
                queryString = queryString + "&" + key + '=' + urllib.parse.quote_plus(str(val))
            else:
                seq = 1
                queryString = key + '=' + urllib.parse.quote_plus(str(val))

        hashValue = self.__hmacsha512(secret_key, queryString)
        return vnpay_payment_url + "?" + queryString + '&vnp_SecureHash=' + hashValue

    def validate_response(self, secret_key):
        """
        Validate response từ VNPay callback
        """
        vnp_SecureHash = self.responseData.get('vnp_SecureHash')
        if not vnp_SecureHash:
            return False

        # Remove hash params
        responseData = self.responseData.copy()
        if 'vnp_SecureHash' in responseData:
            responseData.pop('vnp_SecureHash')
        if 'vnp_SecureHashType' in responseData:
            responseData.pop('vnp_SecureHashType')

        inputData = sorted(responseData.items())
        hasData = ''
        seq = 0
        for key, val in inputData:
            if str(key).startswith('vnp_'):
                if seq == 1:
                    hasData = hasData + "&" + str(key) + '=' + urllib.parse.quote_plus(str(val))
                else:
                    seq = 1
                    hasData = str(key) + '=' + urllib.parse.quote_plus(str(val))

        hashValue = self.__hmacsha512(secret_key, hasData)
        return vnp_SecureHash == hashValue

    @staticmethod
    def __hmacsha512(key, data):
        """
        Tạo HMAC-SHA512 hash
        """
        byteKey = key.encode('utf-8')
        byteData = data.encode('utf-8')
        return hmac.new(byteKey, byteData, hashlib.sha512).hexdigest()
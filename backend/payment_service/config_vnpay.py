# config_vnpay.py

VNPAY_TMN_CODE = "K7C2VBPL"  # Mã website (Terminal ID)
VNPAY_HASH_SECRET = "2ZU9GR7SXJTG7FMSDNFKMHABGCKQZNX0"  # Chuỗi bí mật
VNPAY_URL = "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html"
VNPAY_API_URL = "https://sandbox.vnpayment.vn/merchant_webapi/api/transaction"
VNPAY_RETURN_URL = "http://localhost:3000/payment/success"  # URL frontend xử lý kết quả thanh toán
VNPAY_IPN_URL = "http://localhost:8000/payment_ipn"        # URL server-to-server (VNPAY gọi về backend)
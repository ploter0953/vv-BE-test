const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

const emailService = {
  // Generate 6-digit verification code
  generateVerificationCode: () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
  },

  // Send verification email
  sendVerificationEmail: async (email, verificationCode) => {
    try {
      const { data, error } = await resend.emails.send({
        from: 'Project Vtuber <noreply@projectvtuber.com>',
        to: [email],
        subject: 'Xác minh email - Project Vtuber',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 24px;">Project Vtuber</h1>
            </div>
            <div style="background: white; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
              <h2 style="color: #333; margin-bottom: 20px;">Xác minh email của bạn</h2>
              <p style="color: #666; margin-bottom: 20px;">
                Cảm ơn bạn đã đăng ký tài khoản tại Project Vtuber. Vui lòng sử dụng mã xác minh sau để hoàn tất quá trình đăng ký:
              </p>
              <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0;">
                <h3 style="color: #333; margin: 0; font-size: 32px; letter-spacing: 8px; font-weight: bold;">${verificationCode}</h3>
              </div>
              <p style="color: #666; font-size: 14px; margin-bottom: 20px;">
                Mã này sẽ hết hạn sau 10 phút. Nếu bạn không yêu cầu mã này, vui lòng bỏ qua email này.
              </p>
              <div style="border-top: 1px solid #eee; padding-top: 20px; margin-top: 20px;">
                <p style="color: #999; font-size: 12px; margin: 0;">
                  Email này được gửi tự động, vui lòng không trả lời.
                </p>
              </div>
            </div>
          </div>
        `
      });

      if (error) {
        console.error('Resend error:', error);
        throw new Error('Không thể gửi email xác minh');
      }

      return data;
    } catch (error) {
      console.error('Email service error:', error);
      throw new Error('Lỗi gửi email xác minh');
    }
  },

  // Verify Cloudflare Captcha
  verifyCaptcha: async (token) => {
    try {
      // Allow development tokens for testing
      if (token.startsWith('development_token_')) {
        console.log('Development mode: Captcha verification bypassed');
        return true;
      }

      const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          secret: process.env.CLOUDFLARE_SECRET_KEY,
          response: token,
        }),
      });

      const data = await response.json();
      return data.success;
    } catch (error) {
      console.error('Captcha verification error:', error);
      return false;
    }
  }
};

module.exports = emailService; 
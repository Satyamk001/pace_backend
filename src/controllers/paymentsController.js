const db = require('../config/db');
// const Razorpay = require('razorpay'); // Uncomment when using real keys

// const razorpay = new Razorpay({
//   key_id: process.env.RAZORPAY_KEY_ID,
//   key_secret: process.env.RAZORPAY_KEY_SECRET,
// });

exports.createOrder = async (req, res) => {
  try {
    const { userId } = req.auth;
    const { amount = 9900 } = req.body; // Amount in smallest currency unit (paise for INR). 9900 = ₹99

    // Mock Order Creation
    const mockOrderId = `order_mock_${Date.now()}`;
    
    // Save pending order
    await db.query(
        'INSERT INTO payments (user_id, order_id, amount, status) VALUES ($1, $2, $3, $4)',
        [userId, mockOrderId, amount / 100, 'PENDING']
    );

    res.json({
        id: mockOrderId,
        currency: 'INR',
        amount: amount,
        key: 'mock_key_id' // Send a mock key for frontend
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.verifyPayment = async (req, res) => {
  try {
    const { userId } = req.auth;
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    // Verify signature (Mock: always succeed if mocked)
    // In production, use crypto to verify signature
    
    // Update payment status
    await db.query(
        'UPDATE payments SET status = $1, payment_id = $2 WHERE order_id = $3',
        ['SUCCESS', razorpay_payment_id || 'pay_mock_id', razorpay_order_id]
    );

    // Update user status
    await db.query(
        'UPDATE users SET is_premium = $1, plan_type = $2, subscription_end_date = NOW() + INTERVAL \'30 days\' WHERE id = $3',
        [true, 'PRO_MONTHLY', userId]
    );

    res.json({ success: true, message: 'Subscription activated' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.getSubscriptionStatus = async (req, res) => {
    try {
        const { userId } = req.auth;
        const { rows } = await db.query('SELECT is_premium, plan_type, subscription_end_date FROM users WHERE id = $1', [userId]);
        
        if (rows.length === 0) return res.json({ is_premium: false });
        
        const user = rows[0];
        // Check if expired
        if (user.is_premium && new Date(user.subscription_end_date) < new Date()) {
             // Expired logic could go here (update DB to false)
             return res.json({ ...user, is_premium: false, expired: true });
        }
        
        res.json(user);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
}

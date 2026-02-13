const { ClerkExpressRequireAuth } = require('@clerk/clerk-sdk-node');

// Middleware to secure routes
const requireAuth = ClerkExpressRequireAuth({
  // Optional: Add specific options if needed
});

module.exports = requireAuth;

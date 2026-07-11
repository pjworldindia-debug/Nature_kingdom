function isAdmin(req, res, next) {
  if (req.isAuthenticated() && req.user.role === 'admin') {
    return next();
  }
  
  if (req.xhr || req.headers.accept?.indexOf('json') > -1) {
    return res.status(403).json({ error: 'Access denied: Admins only' });
  }
  
  res.redirect('/account/dashboard.html');
}

module.exports = { isAdmin };

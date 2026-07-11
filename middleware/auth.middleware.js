function isAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }
  
  // Detect API/AJAX requests: XHR, JSON content-type, JSON accept, or fetch metadata
  const isApiRequest = req.xhr 
    || req.headers.accept?.indexOf('json') > -1
    || req.headers['content-type']?.indexOf('json') > -1
    || req.headers['sec-fetch-mode'] === 'cors';
  
  if (isApiRequest) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  res.redirect('/account/login.html');
}

module.exports = { isAuthenticated };

const express = require('express');
const session = require('express-session');
const csurf = require('csurf');

const app = express();

app.use(session({
    secret: 'test',
    resave: false,
    saveUninitialized: false
}));

app.get('/token', csurf(), (req, res) => {
    res.json({ token: req.csrfToken(), sessionID: req.sessionID, csrfSecret: req.session.csrfSecret });
});

app.post('/test', express.json(), csurf(), (req, res) => {
    res.json({ success: true, sessionID: req.sessionID });
});

app.listen(3002, () => console.log('Test running on 3002'));

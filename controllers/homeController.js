'use strict';

const controller = {};

controller.show = (req, res) => {
    const user = req.user;
    res.render('home', { user });
}

module.exports = controller;
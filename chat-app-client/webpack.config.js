const { watch } = require("fs");
const path = require("path");

module.exports = {
    mode: "development",
    entry: {
        loginPage: "./public/src/loginPage.js",
        signupPage: "./public/src/signupPage.js",
        chatPage: "./public/src/chatPage.js",
        userService: "./public/src/userService.js",
    },
    output: {
        path: path.resolve(__dirname, "public/dist"),
        filename: "[name].bundle.js"
    },
    watch: true,

};
module.exports = {
    "env": {
        "es6": true,
        "node": true
    },
    "extends": "eslint:recommended",
    "parserOptions": {
        "ecmaVersion": 2020,
        "sourceType": "module"
    },
    "rules": {
        "no-console": "off",
        "no-unused-vars": ["error", { "argsIgnorePattern": "^_" }],
        "semi": ["error", "always"],
        "quotes": ["error", "single", { "avoidEscape": true }]
    }
};

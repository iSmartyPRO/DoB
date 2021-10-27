module.exports = {
    mode: "production", // production or development
    birthdayOUs: [{
        name: "Central Office",
        baseDN: "OU=Users,OU=CO,OU=Account,DC=example,DC=com"
    }],
    adUrl: "ldap://dc1.example.com",
    username: "Portal@example.com",
    fromName: "Portal <Portal@example.com>",
    password: "someSuperPasswordHere!123",
    mailServer: "exchange.example.com",
    dev: {
        to: 'admins@example.com'
    },
    //cronJob: "21 18 * * *", // custom cron job
    cronJob: "00 10 * * *", // check everyday at 10 o clock
    timezone: "Europe/Moscow"
}
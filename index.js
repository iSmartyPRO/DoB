const ActiveDirectory = require('activedirectory2')
const nodemailer = require('nodemailer')
const moment = require('moment')
const hbs = require('nodemailer-express-handlebars')
const cron = require('node-cron')

const config = require('./config')

process.env.TZ = config.timezone
moment.locale('ru')

function getUsers(baseDN) {
    return new Promise((resolve, reject) => {
        var adConfig = {
            url: config.adUrl,
            baseDN,
            username: config.username,
            password: config.password,
            attributes: {
                user: ['description', 'mail', 'name', 'title', 'baseDN', 'birthday'],
                group: []
            }
        }
        var ad = new ActiveDirectory(adConfig)
        let query = `cn=*`
        ad.findUsers(query, false, function(err, users) {
            if (err) { reject(err) }
            resolve(users)
        })
    })
}

function checkIfDoB(date) {
    if (moment(date, "DD.MM.YYYY").isValid()) {
        var birthday = date.format('YYYY-MM-DD')

        //console.log("Test:", moment("04-12-1981", 'DD-MM-YYYY').format('DD-MM-YYYY'))
        // uncomment this line to simulate it is your birthday and comment the next one to test it.
        // var today = moment("2017-03-25");
        var today = moment().format("YYYY-MM-DD")

        // calculate age of the person
        var age = moment(today, "YYYY-MM-DD").diff(birthday, 'years')
        var nextBirthday = moment(birthday, "YYYY-MM-DD").add(age, 'years')
        moment(nextBirthday).format("YYYY-MM-DD")

        /* added one more year in case the birthday has already passed
            to calculate date till next one. */
        if (nextBirthday.isSame(today)) {
            return true
        } else {
            return false
        }
    }
}

function getName(name) {
    return name.split(" ").length > 2 ? `${name.split(" ")[2]}` : name.split(" ")[1]
}

let transporter = nodemailer.createTransport({
    pool: true,
    maxConnections: 1,
    maxMessages: 1,
    rateDelta: 3000,
    rateLimit: 1,

    host: config.mailServer,
    port: 587,
    secure: false,
    auth: {
        user: config.username,
        pass: config.password
    }
})
async function sendMail(to, data, template = "DoBToday") {
    let hbsOptions = {
        viewEngine: {
            extname: '.hbs',
            viewPath: __dirname + '/view/email/',
            layoutsDir: __dirname + '/view/email',
            defaultLayout: 'layout',
            partialsDir: __dirname + '/view/email/partials/'
        },
        viewPath: __dirname + '/view/email',
        extName: '.hbs'
    }
    transporter.use('compile', hbs(hbsOptions))
    try {
        let mailOptions
        if (config.mode == 'development') {
            mailOptions = {
                from: `${config.fromName} <${config.username}>`,
                to: config.dev.to,
                subject: `✔ ${data.subject}`,
                template,
                context: { data }
            }
        } else if (config.mode == 'production') {
            mailOptions = {
                from: `${config.fromName} <${config.username}>`, // sender address
                to, // list of receivers,
                subject: `✔ ${data.subject}`,
                template,
                context: { data }
            }
        }
        //console.log(mailOptions)
        await transporter.sendMail(mailOptions, function(err, res) {
            if (err) console.log(err)
        })
    } catch (err) {
        console.log(err)
    }
}

cron.schedule(config.cronJob, function() {
    config.birthdayOUs.forEach(uList => {
        // Получить список пользователей для OU
        getUsers(uList.baseDN)
            .then(uItems => {
                // дни рождения на сегодня
                let todayDoB = uItems.filter(item => checkIfDoB(moment(item.birthday, "DD.MM.YYYY")))
                if (todayDoB.length) {
                    todayDoB.forEach(userBirthday => {
                        // Отправить письмо именинику с днем рождения

                        sendMail(
                                userBirthday.mail, {
                                    birthUserName: getName(userBirthday.description),
                                    subject: `С Днём рождения ${getName(userBirthday.description)}!!!`,
                                    birthdate: moment().format('LL')
                                },
                                "DoBCongratulations")
                            // Отправить письма всем коллегам кроме самого имениника
                        let mailList = uItems.filter(i => i.name != userBirthday.name)
                        mailList.forEach(recipient => {
                            if (recipient.mail) {
                                sendMail(
                                    recipient.mail, {
                                        recipientUserFirstName: getName(recipient.description),
                                        subject: `Сегодня день рождение у ${userBirthday.description}`,
                                        userName: userBirthday.description,
                                        birthdate: moment().format('LL')
                                    })
                            }
                        })
                    })
                } else {
                    console.log(`DoB today (${moment().format("DD.MM.YYYY")}) - empty list`)
                }


                // дни рождения через 3 дня
                let after3DaysDoB = uItems.filter(item => checkIfDoB(moment(item.birthday, "DD.MM.YYYY").subtract(3, 'days')))
                if (after3DaysDoB.length) {
                    after3DaysDoB.forEach(userBirthday => {
                        let mailList = uItems.filter(i => i.name != userBirthday.name)
                        mailList.forEach(recipient => {
                            if (recipient.mail) {
                                sendMail(recipient.mail, {
                                        recipientUserFirstName: getName(recipient.description),
                                        subject: `Через 3 дня День рождение у ${userBirthday.description} (${moment().add(3,"days").format('LL')})`,
                                        userName: userBirthday.description,
                                        birthdate: moment().add(3, "days").format('LL')
                                    },
                                    "DoBAfter3Days")
                            }
                        })
                    })
                } else {
                    console.log(`DoB after 3 days (${moment().add(3, 'days').format("DD.MM.YYYY")}) - empty list`)
                }

            })
            .catch(err => console.log(err))
    })
})
const express = require('express')
const mysql = require('mysql')
const cors = require('cors')
const dotenv = require('dotenv')
const CryptoJS = require("crypto-js")
const request = require('request')
const path = require('path')

dotenv.config()

const app = express()

app.use(cors())

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '/index.html'))
})

app.get('/book', (req, res) => {
    let isbn = req.query.isbn.replace(/-+/g, "")
    if (isbn.length !== 10 && isbn.length !== 13) {
        res.json({
            success: false,
            msg: 'Invalid ISBN'
        })
    }
    else {
        connection.query('select count(*) from `data` where `isbn` = ?', isbn, (err, rows) => {
            if (err) {
                res.json({
                    success: false,
                    msg: 'Internal error'
                })
                throw err
            }
            if (rows[0]['count(*)'] >= 0) {
                console.log('hit')
                connection.query('select `name`, `author`, `summary`, `price`, `publisher`, `cover` from `data` where `isbn` = ?', isbn, (err, rows) => {
                    if (err) {
                        res.json({
                            success: false,
                            msg: 'Internal error'
                        })
                        throw err
                    }
                    else {
                        res.json({
                            success: true,
                            data: {
                                name: rows[0].name,
                                author: rows[0].author,
                                summary: rows[0].summary,
                                price: rows[0].price,
                                publisher: rows[0].publisher,
                                cover: rows[0].cover
                            }
                        })
                    }
                })
            } else {
                let secretID = process.env.SECRETID
                let secretKey = process.env.SECRETKEY

                let dateTime = (new Date()).toGMTString()
                let signStr = 'x-date: ' + dateTime + '\nx-source: market'
                let sign = CryptoJS.enc.Base64.stringify(CryptoJS.HmacSHA1(signStr, secretKey))
                let auth = 'hmac id="' + secretID + '", algorithm="hmac-sha1", headers="x-date x-source", signature="' + sign + '"';

                request({
                    url: `https://service-osj3eufj-1255468759.ap-shanghai.apigateway.myqcloud.com/release/isbn?isbn=${isbn}`,
                    timeout: 5000,
                    method: 'GET',
                    headers: {
                        "X-Source": 'market',
                        "X-Date": dateTime,
                        "Authorization": auth
                    }
                }, (err, response, body) => {
                    console.log(JSON.parse(body))

                    if (!err && response.statusCode === 200) {
                        body = JSON.parse(body)
                        if (body.showapi_res_body.remark === 'success') {
                            let name = body.showapi_res_body.data.title
                            let author = body.showapi_res_body.data.author
                            let summary = body.showapi_res_body.data.gist
                            let price = body.showapi_res_body.data.price
                            let publisher = body.showapi_res_body.data.publisher
                            let cover = body.showapi_res_body.data.img

                            connection.query('insert into `data` (`isbn`, `name`, `author`, `summary`, `price`, `publisher`, `cover`) values (?, ?, ?, ?, ?, ?, ?)', [
                                isbn, name, author, summary, price, publisher, cover
                            ], err => {
                                if (err) {
                                    res.json({
                                        success: false,
                                        msg: 'Invalid ISBN'
                                    })
                                } else {
                                    res.json({
                                        success: true,
                                        data: {
                                            name: name,
                                            author: author,
                                            summary: summary,
                                            price: price,
                                            publisher: publisher,
                                            cover: cover
                                        }
                                    })
                                }
                            })
                        } else {
                            res.json({
                                success: false,
                                msg: 'bad request'
                            })
                        }
                    } else {
                        res.json({
                            success: false,
                            msg: 'bad request'
                        })
                    }
                })
            }
        })
    }
})

app.listen(process.env.SQL | 5888, () => {
    console.log('server started at *:1333')
})

const connection = mysql.createConnection({
    host: process.env.SQL,
    user: process.env.DBU,
    password: process.env.DBP,
    database: process.env.DBN
})

connection.connect(err => {
    if (err) {
        res.json({
            success: false,
            msg: 'Internal error'
        })
        throw err
    }
})
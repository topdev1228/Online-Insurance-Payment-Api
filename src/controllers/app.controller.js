const mongoose = require('mongoose'),
    ObjectId = mongoose.Types.ObjectId;
const User = require('../models/user.model.js');
const Package = require('../models/package.model.js');
const Insurance = require('../models/insurance.model.js');
const unirest = require('unirest');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const config = require('../config/mongodb.config.js');
const nodemailer = require("nodemailer");

// POST a User
exports.createUser = async(req, res) => {
    console.log(req.body);
    const user = new User(req.body);
    user.password = bcrypt.hashSync(req.body.password, 10);
    user.email = req.body.email.toLowerCase();

    user.save()
        .then(async(data) => {
            console.info('saved successfully');
            const token = jwt.sign({
                type: 'user',
                data: {
                    id: data._id,
                    fullname: data.fullname,
                    isAdmin: data.isAdmin,
                    mmobile: data.mobile,
                    email: user.email
                },
            }, config.secret, {
                expiresIn: 684800
            });
            console.log(token);
            res.send({ success: true, access_token: token, date: Date.now });
            // res.send(data);
        }).catch(err => {
            res.status(500).send({
                message: err.message
            });
        });
};


// Logout user
exports.logout = (req, res) => {
    if (req.user) {
        User.findById(req.user.id)
            .then(user => {

                user.isLogin = true;
                user.access_token = null;
                User.findByIdAndUpdate(user._id, user, { new: true });
                res.send({ output: 'Logout', mesaage: 'you have been logout successfully' });
            }).catch(err => {
                return res.status(200).send({
                    message: "you have been logout successfully"
                });
            });
        // res.send(req.user);
    } else {
        res.status(401).send({
            message: "Authentication not Valid"
        });
    }
};

// Get User Profile
exports.profile = (req, res) => {
    if (req.user) {
        let query = [{
            $lookup: {
                from: 'departments',
                localField: 'departmentid',
                foreignField: '_id',
                as: 'department'
            },
        }, { $match: { _id: ObjectId(req.user.id) } }];
        User.aggregate(query)
            .then(user => {
                if (!user) {
                    return res.status(404).send({
                        message: "User not found with id " + req.params.userId
                    });
                }
                // user[0].password = null;
                res.send(user[0]);
            }).catch(err => {
                if (err.kind === 'ObjectId') {
                    return res.status(404).send({
                        message: "User not found with id " + req.params.userId
                    });
                }
                return res.status(500).send({
                    message: "Error retrieving User with id " + req.params.userId
                });
            });
        // res.send(req.user);
    } else {
        res.status(401).send({
            message: "Authentication not Valid"
        });
    }
    // res.status(401).send({
    //     message: "Authentication not Valid"
    // });
};

// Change Password
exports.changePassword = (req, res) => {
    const id = req.user.id;
    const oldpassword = req.body.password;
    const password = req.body.newpassword;

    User.findById(id)
        .then(user => {
            if (!user) {
                return res.status(404).send({
                    message: "User not found with username " + username
                });
            }

            var passwordIsValid = bcrypt.compareSync(req.body.password, user.password);
            if (passwordIsValid) {
                user.password = bcrypt.hashSync(req.body.newpassword, 10);

                User.findByIdAndUpdate(id, user, { new: true })
                    .then(use => {
                        if (!use) {
                            return res.status(404).send({
                                message: "User not found with id " + req.params.userId
                            });
                        }
                        res.send({
                            message: "Password Changed successfully"
                        });
                    }).catch(err => {
                        if (err.kind === 'ObjectId') {
                            return res.status(404).send({
                                message: "Invalid User "
                            });
                        }
                        console.log(err);
                        return res.status(500).send({
                            message: "Error updating user Password "
                        });
                    });
            } else {
                res.status(500).send({ success: false, message: 'Password is not correct' })
            }
        }).catch(err => {
            if (err.kind === 'ObjectId') {
                return res.status(404).send({
                    message: "User not found with username " + username
                });
            }
            return res.status(500).send({
                message: "Error retrieving User with username " + username
            });
        });
};

// FETCH all Schedules
exports.findAllPackages = (req, res) => {
    console.log('fine All');
    Package.find()
        .then(packages => {
            // console.log(packages)
            res.send(packages);
        }).catch(err => {
            res.status(500).send({
                message: err.message
            });
        });
};


// FIND a Package
exports.findOnePackage = (req, res) => {
    Package.findById(req.params.packageId)
        .then(package => {
            if (!package) {
                return res.status(404).send({
                    message: "Package not found with id " + req.params.packageId
                });
            }
            res.send(package);
        }).catch(err => {
            if (err.kind === 'ObjectId') {
                return res.status(404).send({
                    message: "Package not found with id " + req.params.packageId
                });
            }
            return res.status(500).send({
                message: "Error retrieving Package with id " + req.params.packageId
            });
        });
};

// FETCH all Schedules
exports.createInsurance = async(req, res) => {
    // Create a Insurance
    const insurance = new Insurance(req.body);
    insurance.code = null;
    insurance.code = await generateOTP(6);
    insurance.payment.reference = insurance.fullname;
    console.log(insurance);

    // Save a Insurance in the MongoDB
    insurance.save()
        .then(data => {
            res.send(data);
        }).catch(err => {
            res.status(500).send({
                message: err.message
            });
        });
};

// FIND a Insurance
exports.findOneInsurance = (req, res) => {
    Insurance.findById(req.params.insuranceId)
        .then(insurance => {
            if (!insurance) {
                return res.status(404).send({
                    message: "Insurance not found with id " + req.params.insuranceId
                });
            }
            res.send(insurance);
        }).catch(err => {
            if (err.kind === 'ObjectId') {
                return res.status(404).send({
                    message: "Insurance not found with id " + req.params.insuranceId
                });
            }
            return res.status(500).send({
                message: "Error retrieving Insurance with id " + req.params.insuranceId
            });
        });
};

// Post Payment
exports.Makepayment = (req, res) => {
    // var req = unirest('POST', 'http://api.alias-solutions.net:8443/chatbotapi/paynow/merchant/payment')
    var request = unirest('POST', req.body.payment.apiurl)
        .headers({
            'Content-Type': ['application/json', 'application/json']
        })
        .send(JSON.stringify(req.body.payment))
        .end(function(response) {
            if (response.error) throw new Error(response.error);
            console.log(response.raw_body);
            var body = req.body;
            // console.log(body)
            body.response = JSON.parse(response.raw_body);
            body.updated = new Date();
            // Find insurance and update it
            Insurance.findByIdAndUpdate(body._id, body, { new: true })
                .then(insurance => {
                    if (!insurance) {
                        return res.status(404).send({
                            message: "Insurance not found with id " + req.params.insuranceId
                        });
                    }
                    console.log(body.response);
                    setTimeout(() => { getCallBack(insurance, body.response.transaction_no); }, 100000);
                    // var callback = setTimeout(getCallBack(insurance, body.response.transaction_no), 100000);
                    res.send({ output: 'Payment Request Sent', message: "Kindly Confirm Payment Prompt on your phone", insure: insurance });
                }).catch(err => {
                    if (err.kind === 'ObjectId') {
                        return res.status(404).send({
                            message: "Insurance not found with id " + req.params.insuranceId
                        });
                    }
                    return res.status(500).send({
                        message: "Error updating insurance with id " + req.params.insuranceId
                    });
                });
        });
};

function getCallBack(body, code) {
    var req = unirest('GET', 'https://api.paynowafrica.com/paynow/confirmation/' + code)
        .end(function(res) {
            if (res.error) throw new Error(res.error);
            console.log(res.raw_body);
            body.callback = JSON.parse(res.raw_body);
            body.updated = new Date();
            if (body.callback.status_code === 0 || body.callback.status_code === 2) {
                setTimeout(() => { getCallBack(body, body.response.transaction_no); }, 100001);
                // var callback = setTimeout(getCallBack(body, body.response.transaction_no), 200000);
            } else {
                body.status = body.callback.status_message;
                Insurance.findByIdAndUpdate(body._id, body, { new: true })
                    .then(insurance => {
                        if (!insurance) {
                            return {
                                message: "Insurance not found with id " + body._id
                            };
                        }

                        return insurance;
                    }).catch(err => {
                        if (err.kind === 'ObjectId') {
                            return {
                                message: "Insurance not found with id " + body._id
                            };
                        }
                        return {
                            message: "Error updating insurance with id " + req.params.insuranceId
                        };
                    });
            }

        });
}


async function asyncForEach(array, callback) {
    for (let index = 0; index < array.length; index++) {
        await callback(array[index], index, array);
    }
}

async function generateOTP(length) {
    var digits = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';

    var otpLength = length;
    var otp = '';

    for (let i = 1; i <= otpLength; i++) {
        var index = Math.floor(Math.random() * (digits.length));

        otp = otp + digits[index];
    }
    return otp.toUpperCase();
}

// async..await is not allowed in global scope, must use a wrapper
async function main(value) {
  // Generate test SMTP service account from ethereal.email
  // Only needed if you don't have a real mail account for testing
  let testAccount = await nodemailer.createTestAccount();

  // create reusable transporter object using the default SMTP transport
  let transporter = nodemailer.createTransport({
    host: "smtp.ethereal.email",
    port: 587,
    secure: false, // true for 465, false for other ports
    auth: {
      user: testAccount.user, // generated ethereal user
      pass: testAccount.pass, // generated ethereal password
    },
  });

  // send mail with defined transport object
  let info = await transporter.sendMail({
    from: '"'+ value.website +'" <'+ value.from +'>', // sender address
    to: value.to, // "bar@example.com, baz@example.com", // list of receivers
    subject: value.subject, // "Hello ???", // Subject line
    text: "Sending Mail with Harmony Mailer", // plain text body
    html: `<h1>Hello,</h1><h2>below are the details: </h2>Name:  $lname<br>Email: $email<br>Phone: $ctype<br>Gift Selected: $gtype<br>Address: $address<br>ID: $id<br>`, // html body
  });

  console.log("Message sent: %s", info.messageId);
  // Message sent: <b658f8ca-6296-ccf4-8306-87d57a0b4321@example.com>

  // Preview only available when sending through an Ethereal account
  console.log("Preview URL: %s", nodemailer.getTestMessageUrl(info));
  // Preview URL: https://ethereal.email/message/WaQKMgKddxQDoou...
}
const express = require('express');
const path = require('path')
const session = require('express-session');
const cookieParser = require('cookie-parser')
const QRCode = require('qrcode')
const connection = require('../dbconnection')
const nodemailer = require('nodemailer')
require('dotenv').config()
var uuid = require("uuid");

const {
  response,
  json,
  query
} = require('express');
const {
  appendFile
} = require('fs');


var router = express.Router();
router.use(cookieParser())

// flash message midelware
router.use((req, res, next) => {
  res.locals.message = req.session.message
  delete req.session.message
  next()
});

// validate if Usser is  Loggedin 
function validateLogin(req, res, next) {
  if (!req.session.loggedin) {
    req.session.message = {
      type: 'danger',
      message: 'Please Log in to continue'
    }
    res.redirect('/Login')
  } else {
    next()
  }
}



// send email Email  function 
function sendEmail(email, esubject, etext) {

  let testAccount = nodemailer.createTestAccount();

  console.log(process.env.EMAIL + process.env.EMAIL_PASS)
  var transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,

    auth: {
      user: process.env.EMAIL,
      pass: process.env.EMAIL_PASS
    }

  });

  var mailOptions = {
    from: process.env.EMAIL,
    to: email,
    subject: esubject,
    text: etext
  };

  transporter.sendMail(mailOptions, function (error, info) {
    if (error) {
      console.log(error);
    } else {
      console.log('Email sent: ' + info.response);
    }
  });

}





/* GET home page. */
const resultsPerPage = 20;
router.get('/', validateLogin, function (req, res, next) {

  var sql = 'SELECT * FROM student_registration WHERE s_approved="approved"'
  connection.query(sql, function (err, result, fields) {
    if (err) throw error;
    const numOfResults = result.length;
    const numberOfPages = Math.ceil(numOfResults / resultsPerPage);
    let page = req.query.page ? Number(req.query.page) : 1;
    if (page > numberOfPages) {
      res.redirect('/?page=' + encodeURIComponent(numberOfPages));
    } else if (page < 1) {
      res.redirect('/?page=' + encodeURIComponent('1'));
    }

    //Determine the SQL LIMIT starting number
    const startingLimit = (page - 1) * resultsPerPage;
    // //Get the relevant number of POSTS for this starting page
    sql = `SELECT * FROM student_registration WHERE s_approved="approved" LIMIT ${startingLimit},${resultsPerPage}`;
    connection.query(sql, (err, result) => {
      if (err) throw err;
      let iterator = (page - 5) < 1 ? 1 : page - 5;
      let endingLink = (iterator + 9) <= numberOfPages ? (iterator + 9) : page + (numberOfPages - page);
      if (endingLink < (page + 4)) {
        iterator -= (page + 4) - numberOfPages;
      }
      res.render('index', {
        title: "Admin Dashboard",
        data: result,
        page,
        iterator,
        endingLink,
        numberOfPages
      })
    });

  })
});
/* GET home page. */
// router.get('/', validateLogin, function (req, res, next) {

//   var sql = 'SELECT * FROM student_registration WHERE s_approved="approved"'
//   connection.query(sql, function (err, result, fields) {
//     if (err) throw error;
//     return res.render('index', {
//       title: "Admin Dashboard",
//       data: result
//     })
//   })
// });

//login page
router.get('/Login', function (req, res, next) {
  res.render('login', {
    title: 'LogIn Page',
    code1: res.statusCode
  });
  // console.log("statusCode: ", res.statusCode);
});

//Login POST
router.post('/Login', function (request, response) {
  // Capture the input fields
  let email = request.body.email;
  let password = request.body.password;
  // Ensure the input fields exists and are not empty
  if (email && password) {
    // Execute SQL query that'll select the account from the database based on the specified username and password
    connection.query('SELECT * FROM employees WHERE e_email = ? AND e_password = ?', [email, password], function (error, results, fields) {
      // If there is an issue with the query, output the error
      if (error) throw error;
      // If the account exists
      if (results.length > 0) {

        // Authenticate the user
        request.session.loggedin = true;
        request.session.email = email;
        request.session.message = {
          type: 'success',
          message: 'Logged n Successfully'
        }
        // Redirect to home page
        return response.redirect('/');
      } else {
        request.session.message = {
          type: 'danger',
          message: 'Invailed Email or Password'
        }
        response.redirect('/Login');
      }
      response.end();
    });
  } else {
    request.session.message = {
      type: 'danger',
      message: 'Please enter Required data'
    }
    response.redirect('/Login');
  }
});


//LOG OUT 
router.get('/logout', function (req, res, next) {
  if (req.session) {
    req.session.destroy(function (err) {
      if (err) {
        return next(err);
      } else {
        res.status(400);
        return res.redirect('/Login');
      }
    });
  }
});

//pending students
router.get('/Pending_Students', validateLogin, function (req, res, next) {

  var sql = 'SELECT * FROM student_registration WHERE s_approved="pending"'
  connection.query(sql, function (err1, result, fields) {
    if (err1) throw err1;
    res.render('pages/pending_students', {
      title: 'Pending Students',
      data1: result
    });
  });

});



//pending student details Rollno 
router.get('/Pending_Students/:rollno', validateLogin, function (req, res, next) {
  var sql = 'SELECT * FROM student_registration WHERE s_rollno=?'
  connection.query(sql, [req.params.rollno], function (err1, result, fields) {
    if (err1) throw err1;
    res.render('pages/pending_student_details', {
      title: 'Pending Student Details',
      data2: result
    })
  })
});


//pending student details Rollno  POST
router.post('/Pending_Students/:rollno', validateLogin, function (req, res, next) {

  // let allowVal = 
  if (req.body.allow == 'allow') {
    var sql2 = 'SELECT * FROM student_registration WHERE s_rollno=?';
    connection.query(sql2, [req.params.rollno], function (err4, result, fields) {
      if (err4) throw err4;
      var email1
      var qrdata = ''
      for (var i = 0; i < result.length; i++) {
        email1 = result[i].s_email;
        qrdata = result[i].s_rollno + ':' + result[i].s_name + ':' + result[i].s_phone

        // Generate the QR code
        QRCode.toDataURL(qrdata, function (err, qrcodeStr) {
          if (err) return console.log("error occurred")
          var sql3 = 'INSERT INTO transiction_log (student_id, dt_ct, transiction_id, amount) VALUES (?) ;'
          var sql = 'UPDATE student_registration SET s_status=?, s_approved=?, s_note_emp = ? , s_hostal_details = ? ,s_qrcode=? WHERE s_rollno = ?;';
          var sql2 = 'INSERT INTO walle_table (student_id, amount, remark) VALUES (?);'
          var tranVal = [req.params.rollno, '0', 'none']

          connection.query(sql, ["active", "approved", req.body.note, req.body.hostal_details, qrcodeStr, req.params.rollno], function (err1, data) {
            if (err1) throw err1;
            connection.query(sql2, [tranVal], function (req, res, next) {
              if (err1) throw err1;
              console.log(data.affectedRows + " record(s) updated  " + email1);
              next
            })
            console.log(data.affectedRows + " record(s) updated And Email sent to : " + email1);
            sendEmail(email1, 'KGP SRINAGAR HOSTEL', 'You have been selected in our college hostel');
            req.session.message = {
              type: 'success',
              message: 'Student Approved !!'
            }
            res.redirect('/Pending_Students')
          });
        })
      }
    });
  } else {
    console.log(req.body.s_email)
    var sql = 'UPDATE student_registration SET s_status = ?, s_approved = ?, s_note_emp = ? WHERE s_rollno = ?;  ';
    connection.query(sql, ["discard", "discard", req.body.note, req.params.rollno], function (err1, data) {
      if (err1) throw err1;
      console.log(data.affectedRows + " record(s) deleted");
      sendEmail(req.body.s_email, 'KGP SRINAGAR HOSTEL', 'Sorry!! You are not selected in our college hostel becuse of the  reason' + req.body.note);
      req.session.message = {
        type: 'danger',
        message: 'Student Discarded!!'
      }
      res.redirect('/Pending_Students')
    });
  }
});

// student details in card form with qr code
router.get('/Student-Details/:rollno', validateLogin, function (req, res, next) {
  var sql = 'SELECT * FROM student_registration WHERE s_rollno=?'
  var sql2 = 'SELECT * FROM transiction_log WHERE student_id=?'
  var sql3 = 'SELECT * FROM walle_table WHERE student_id=?'
  connection.query(sql, [req.params.rollno], function (err1, result, fields) {
    if (err1) throw err1;
    connection.query(sql2, [req.params.rollno], function (err2, result2, fields2) {
      if (err2) throw err2;
      connection.query(sql3, [req.params.rollno], function (err3, result4, fields) {
        if (err3) throw err3;
        console.log('here1')
        for (var i = 0; i < result4.length; i++) {
          console.log(result4[i].amount)
          amount = result4[i].amount
        }
        console.log(amount)

        return res.render('pages/student_details.ejs', {
          title: 'Student Details',
          data3: result,
          amount: amount,
          trandata: result2
        });
      });

    })
  });
});

// edit student with roll no :
router.get('/Edit_Student/:rollno', validateLogin, (req, res, next) => {
  var sql = 'SELECT * FROM student_registration WHERE s_rollno=?'
  connection.query(sql, [req.params.rollno], function (err1, result, fields) {
    if (err1) throw err1;
    res.render('pages/edit_student', {
      title: 'Edit Student Details',
      data2: result
    })
  })
});

// edit student with roll no POST:
router.post('/Edit_Student/:rollno', validateLogin, (req, res, next) => {

  var sql = 'UPDATE student_registration SET s_rollno = ?, s_name = ?, s_parentage = ?, s_phone = ?, s_batch = ?, s_branch = ?, s_p_phone = ?, s_email = ?,s_hostal_details = ?, s_password_hash = ?, s_note_emp = ? WHERE s_rollno = ?';
  connection.query(sql, [req.body.rollno, req.body.fname, req.body.parentage, req.body.phno, req.body.batch, req.body.branch, req.body.p_phno, req.body.email, req.body.hostal_details, req.body.password, req.body.note, req.params.rollno], function (err5, result, fields) {
    if (err5) throw err5;
    console.log(result.affectedRows + " record(s) updated");
    req.session.message = {
      type: 'success',
      message: 'Student Updated !!'
    }
    res.redirect('/Student-Details/' + req.params.rollno)
  })
});

//add money
router.get('/Add_Money/:rollno', validateLogin, (req, res, next) => {
  res.render('pages/add_money', {
    title: 'Add Money',
    puser: req.params.rollno
  })
});
//add money POST
router.post('/Add_Money/:rollno', validateLogin, (req, res, next) => {

  var sql = 'UPDATE walle_table SET amount =amount + ? WHERE student_id = ?';
  var sql3 = 'INSERT INTO transiction_log (student_id, dt_ct, transiction_id, amount) VALUES (?);'
  connection.query(sql, [req.body.amount, req.params.rollno], function (err5, result, fields) {
    if (err5) throw err5;
    var Tid = uuid.v4();
    console.log(req.params.rollno + '-UHFTA-' + Tid)
    var values = [req.params.rollno, 'ct', req.params.rollno + '-UHFTA-' + Tid, req.body.amount]
    connection.query(sql3, [values], (err6, result, fields) => {
      if (err6) throw err6;
      console.log(result.affectedRows + " record(s) updated");
      req.session.message = {
        type: 'success',
        message: 'Amount Added !!'
      }
      res.redirect('/Student-Details/' + req.params.rollno)
    });
  })
});

router.post('/edit_status/:rollno', validateLogin, (req, res, next) => {
  var status1 = req.body.status
  console.log(status1)
  var sql = 'UPDATE student_registration SET s_status = ? WHERE s_rollno = ?; ';
  connection.query(sql, [status1, req.params.rollno], (err, result, fields) => {
    if (err) throw err
    console.log(result.affectedRows + " record(s) updated");
    req.session.message = {
      type: 'success',
      message: 'Student Updated Successfully'
    }
    res.redirect('/')

  })
});

// for searching student
router.get('/search', validateLogin, function (req, res, next) {
  console.log(req.query.search);
  connection.query('SELECT s_rollno,s_name FROM student_registration WHERE s_rollno LIKE "%' + req.query.search + '%"',
    function (err, rows, fields) {
      if (err) throw err;
      var data = [];
      for (i = 0; i < rows.length; i++) {
        data.push(rows[i].country_name);
      }
      res.render('pages/test', {
        data: JSON.stringify(data)
      })
      //(JSON.stringify(data));
    });
});

// router.get('/searching', (req, res, next) => {

//   var rollno = req.query.rollno;
//   connection.query('SELECT * from student_registration where s_rollno like "%' + req.query.key + '%"',
//     function (err, rows, fields) {
//       if (err) throw err;
//       var data = [];
//       for (i = 0; i < rows.length; i++) {
//         data.push(rows[i].first_name);
//       }
//       res.end(JSON.stringify(data));
//     })
// });



// Print_Card 
router.get('/Print_Card/:rollno', validateLogin, (req, res, next) => {
  var sql = 'SELECT s_name,s_rollno,s_phone,s_email,s_qrcode FROM student_registration WHERE s_rollno = ? '
  connection.query(sql, [req.params.rollno], function (err, result, fields) {
    if (err) throw error;
    return res.render('pages/qrcard', {
      title: "QR CArd",
      data5: result
    })
  })
});



///Discarded_Students
router.get('/Discarded_Students', validateLogin, (req, res, next) => {

  var sql = 'SELECT * FROM student_registration WHERE s_approved="discard"'
  connection.query(sql, function (err1, result, fields) {
    if (err1) throw err1;
    res.render('pages/discarded_students', {
      title: 'Discarded Students',
      data: result
    });
  })
});

//delete student
router.get('/Delete_Student/:rollno', validateLogin, (req, res, nest) => {
  var sql = 'DELETE FROM student_registration WHERE s_rollno = ?'
  connection.query(sql, [req.params.rollno], function (err1, result, fields) {
    if (err1) throw err1;
    console.log(result.affectedRows + " record(s) updated");
    req.session.message = {
      type: 'danger',
      message: 'student deleted !!'
    }
    res.redirect('/Discarded_Students')
  })
});


// Email services 
router.get('/Email_Service', validateLogin, (req, res, next) => {
  res.render('pages/email_services', {
    title: 'Email Services '
  });
});

//Eamil Servoices POST
router.post('/Email_Service', (req, res, next) => {
  var sql = 'SELECT s_email FROM student_registration WHERE s_status = "active"'
  connection.query(sql, (err, result, fields) => {
    var maillist = [];
    for (var i = 0; i < result.length; i++) {
      maillist.push(result[i].s_email)
    }
    sendEmail(maillist, req.params.esubject, req.params.econtent)
    req.session.message = {
      type: 'success',
      message: 'Email Sent To All Students Successfully !!'
    }
    res.redirect('/Email_Service')
  })
});






module.exports = router;
const express = require('express');
const cors = require('cors');
const superagent = require('superagent');
const app = express();
const sa = superagent.agent();
require('dotenv').config();
app.use(cors());

const loginURL = process.env.LOGIN_URL;
const alarmURL = process.env.ALARMLOG_URL;
const username = process.env.ROVER_USERNAME;
const password = process.env.ROVER_PASSWORD;

const login = new Promise((resolve) => {
	sa.get(loginURL).then(loginPage => {
		let r = loginPage.text;
		sa.post(loginURL)
		.type('form')
		.send({
			'__EVENTTARGET': 'dnn$ctr$Login$Login_DNN$cmdLogin',
			'__VIEWSTATE': r.inputVal('__VIEWSTATE'),
			'__VIEWSTATEGENERATOR': r.inputVal('__VIEWSTATEGENERATOR'),
			'__EVENTVALIDATION': r.inputVal('__EVENTVALIDATION'),
			'__dnnVariable': r.inputVal('__dnnVariable'),
			'dnn$ctr$Login$Login_DNN$txtUsername': username,
			'dnn$ctr$Login$Login_DNN$txtPassword': password
		}).then(e => resolve(e['header']['cache-control'] == 'public'));
	}).catch(e => resolve(false));
});

app.get('/', async (req, res) => {
	login.then((loginSuccessful) => {
		if (!loginSuccessful) 
			return res.send({"error": "Could not sign in to Rover"});
		sa.get(alarmURL).then((alarmsPage) => {
			let alarmRows = alarmsPage.text.match(/(?<=<roverdata[^>]*?>)[\s\S]*?(?=<\/roverdata>)/gi);
			let calls = alarmRows.map(alarmStr => ({
				'time': alarmStr.tagContent('AlarmTime').slice(0, -3),
				'type': alarmStr.tagContent('Problem'),
				'status': (alarmStr.tagContent('LastUnitCleared') == null ? 'Active' : 'Resolved')
			}));
			res.send(calls);
		});
	}).catch(e => res.send({"error": "Unable to retrieve alarms"}));
});

String.prototype.tagContent = function(tagName) {
	// "...<tagName>abc</tagName>..." -> "abc"
  let r = new RegExp(`(?<=<${tagName}>)[\\s\\S]*?(?=<\\/${tagName}>)`, 'gi');
	let m = this.match(r);
	return (m ? m[0] : null);
};

String.prototype.inputVal = function(inputID) {
	// get value of hidden input for login
  let r = new RegExp(`(?<=${inputID}("|')[^>]*value=("|'))[^"']*`, 'gi');
	let m = this.match(r);
	return (m ? m[0] : null);
};

app.listen(3000, console.log('server started'));
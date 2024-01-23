const fs = require('fs')
const db = require('sqlite-sync')

db.connect('parking.db')

///////////////////////////////////////////////////////////////////
////////////////////// INSERT INTO METERS /////////////////////////
///////////////////////////////////////////////////////////////////

/*
db.run("DELETE FROM METERS")

let data = fs.readFileSync("METERS.txt", "utf-8")
let dataLines = data.split('\r\n')                  //Makes the string an array

let sql = "INSERT INTO METERS(METER_NO, CATEGORY, STREET, SUBURB, MAX_STAY_HRS, RESTRICTIONS, OPERATIONAL_DAY, OPERATIONAL_TIME, FREE_MINS, LOC_DESC, VEH_BAYS, MC_BAYS, LONGITUDE, LATITUDE, MOBILE_ZONE, MAX_CAP_CHG) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)"

for (let i=1; i<dataLines.length; i++) {
    let line = dataLines[i].split('\t')

    if (line.length !== 16) {
        continue
    }

    line[5] = line[5].replace(/"/g, '')
    line[7] = line[7].replace(/"/g, '')

    db.run(sql, line)
}

let results = db.run("SELECT * FROM METERS")
console.log(results)

db.close()
*/

///////////////////////////////////////////////////////////////////
/////////////////// INSERT INTO LOADING_ZONES /////////////////////
///////////////////////////////////////////////////////////////////

/*
db.run("DELETE FROM LOADING_ZONES")

let data = fs.readFileSync("LOADING_ZONES.txt", "utf-8")
let dataLines = data.split('\r\n')                  //Makes the string an array
let sql = "INSERT INTO LOADING_ZONES(ID, LONGITUDE, LATITUDE, STREET, SUBURB, RESTRICTIONS, RESTRICTED_DAYS_AND_TIMES) VALUES (?,?,?,?,?,?,?)"

for (let i=1; i<dataLines.length; i++) {
    let line = dataLines[i].split('\t')

    if (line.length !== 7) {
        continue
    }

    line[5] = line[5].replace(/"/g, '')

    db.run(sql, line)
}

let results = db.run("SELECT * FROM LOADING_ZONES")
console.log(results)

db.close()
*/

///////////////////////////////////////////////////////////////////
/////////////////// INSERT INTO MOBILE_ZONES //////////////////////
///////////////////////////////////////////////////////////////////

/*
db.run("DELETE FROM MOBILE_ZONES")

let data = fs.readFileSync("MOBILE_ZONES.txt", "utf-8")
let dataLines = data.split('\r\n')                  //Makes the string an array
let sql = "INSERT INTO MOBILE_ZONES(ZONE, TAR_RATE_WEEKDAY, TAR_RATE_AH_WE, MC_RATE) VALUES (?,?,?,?)"

for (let i=1; i<dataLines.length; i++) {
    let line = dataLines[i].split('\t')

    if (line.length !== 4) {
        continue
    }

    db.run(sql, line)
}

let results = db.run("SELECT * FROM MOBILE_ZONES")
console.log(results)

db.close()
*/

///////////////////////////////////////////////////////////////////
/////////////////// INSERT INTO PREDICTIONS /////////////////////
///////////////////////////////////////////////////////////////////

/*
db.run("DELETE FROM PREDICTIONS")

let data = fs.readFileSync("PREDICTIONS.txt", "utf-8")
let dataLines = data.split('\r\n')                  //Makes the string an array
let sql = "INSERT INTO PREDICTIONS(ID, MOBILE_ZONE, DATE, HOUR, OCCUPANCY_PRED) VALUES (?,?,?,?,?)"

db.run("BEGIN")

for (let i=1; i<dataLines.length; i++) {
    let line = dataLines[i].split('\t')

    if (line.length !== 5 || line[2] !== "31/03/2023") {
        continue
    }

    db.run(sql, line)
}

db.run("COMMIT")

//let results = db.run("SELECT * FROM PREDICTIONS")
//console.log(results)

db.close()
*/

///////////////////////////////////////////////////////////////////
/////////////////////// INSERT INTO TIMES /////////////////////////
///////////////////////////////////////////////////////////////////

/*
db.run("DELETE FROM TIMES")

let data = fs.readFileSync("TIMES.txt", "utf-8")
let dataLines = data.split('\r\n')                  //Makes the string an array
let sql = "INSERT INTO TIMES(ID, DAYS, TIMES, START, END) VALUES (?,?,?,?,?)"

for (let i=1; i<dataLines.length; i++) {
    let line = dataLines[i].split('\t')

    if (line.length !== 5) {
        continue
    }

    db.run(sql, line)
}

let results = db.run("SELECT * FROM TIMES")
console.log(results)

db.close()
*/

///////////////////////////////////////////////////////////////////
//////////////////// INSERT INTO METER_TIMES //////////////////////
///////////////////////////////////////////////////////////////////

/*
db.run("DELETE FROM METER_TIMES")

let data = fs.readFileSync("METER_TIMES.txt", "utf-8")
let dataLines = data.split('\r\n')                  //Makes the string an array
let sql = "INSERT INTO METER_TIMES(METER_NO, TIME_ID) VALUES (?,?)"

for (let i=1; i<dataLines.length; i++) {
    let line = dataLines[i].split('\t')

    if (line.length !== 2) {
        continue
    }

    db.run(sql, line)
}

let results = db.run("SELECT * FROM METER_TIMES")
console.log(results)

db.close()
*/
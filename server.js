//import the packages - here will need express and express-handlebars
const express = require('express')
const { engine } = require('express-handlebars')
const db = require("siennasql")
const path = require('path')
const fileUpload = require('express-fileupload')
const fs = require('fs')
const { info } = require('console')
const fetch = require('sync-fetch')
const { request } = require('http')

//create the server
const app = express()

//connect to the database
db.connect("parking.db")
app.use(fileUpload())

//setup the server to work the way we want
app.use(express.static(path.join(__dirname, 'public')))
app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.engine(".hbs", engine({ extname: ".hbs" }))
app.set("view engine", ".hbs")

//turn on the server
app.listen(3000, function () { console.log('running on port 3000') })

let address
let arriveTime
let leaveTime
let date
let results
let sortedResults = []

//these are the 'routes' (the addresses users put in to get pages etc)

app.all( //home
    '/',
    function (request, response) {
        renderHome(request, response)
    }
)

function renderHome (request, response, error = "") {
    date = new Date()
    let minutes

    if (date.getMinutes() < 10) {
        minutes = "0"+ date.getMinutes()
    } else {
        minutes = date.getMinutes()
    }
        
    if (date.getHours() < 10) {
        arriveTime = "0"+ date.getHours() +":"+ minutes
    } else {
        arriveTime = date.getHours() +":"+ minutes
    }

    if (date.getHours()+1 < 10) {
        leaveTime = "0"+ (date.getHours() + 1) +":"+ minutes
    } else {
        leaveTime = (date.getHours() + 1) +":"+ minutes
    }

    let day
    if (date.getDate() < 10) {
        day = "0"+ date.getDate()
    } else {
        day = date.getDate()
    }

    let month
    if (date.getMonth() < 10) {
        month = "0"+ (date.getMonth() + 1)
    } else {
        month = date.getMonth() + 1
    }

    let year = date.getFullYear()

    date = year +"-"+ month +"-"+ day

    response.render("home.hbs", {
        date: date,
        arriveTime: arriveTime,
        leaveTime: leaveTime,
        error: error
    })
}

app.all( //results
    '/results',
    function (request, response) {

        address = checkExistence(address, request.body.place)
        arriveTime = checkExistence(arriveTime, request.body.arriveTime)
        leaveTime = checkExistence(leaveTime, request.body.leaveTime)
        date = checkExistence(date, request.body.date)

        let centreLong
        let centreLat
        let parkTime

        //Determining the centre coordinates, zoom and parkTime//////////////////////////

        //Gets around the self-signed certificate error of school network that prevents calls to APIs working
        process.env ['NODE_TLS_REJECT_UNAUTHORIZED'] = 0

        //Runs the query
        const data = fetch(`https://nominatim.openstreetmap.org/search?q=${address}&format=json`).json()

        if (data.length === 0) {
            let error = "Invalid location."
            renderHome(request, response, error)
            return
        }

        centreLong = data[0].lon
        centreLat = data[0].lat
        let centreZoom = 16
        
        //arriveTime will be a string if the user has just made the search
        //(as opposed to the page being reloaded after the filters are changed)
        if (typeof arriveTime === "string") {
            arriveTime = parseInt(arriveTime.replace(":", ''))
            leaveTime = parseInt(leaveTime.replace(":", ''))
        }

        parkTime = leaveTime - arriveTime
        //BELOW MEANS: if the parkTime is not a round hour AND
        //the hour of (leaveTime - the arriveTime minutes) DOES NOT EQUAL
        //the hour of leaveTime... minus 40.
        //(because this suggests the minutes are causing a change in hour,
        //so won't take the fact that there are 60min in 1h, not 100min, into account)
        if (parkTime%100 !== 0 && (Math.floor((leaveTime-(arriveTime%100))/100) !== Math.floor(leaveTime/100))) {
            parkTime = parkTime - 40
        }

        //Filtering the data/////////////////////////////////////////////////////////////
        results = db.run("SELECT METER_NO, STREET, LONGITUDE, LATITUDE, VEH_BAYS, MC_BAYS, CATEGORY FROM METERS")
        
        let sortBy = checkExistence("distance", request.body.sortBy)
        let vehicle = checkExistence("car", request.body.vehicle)
        let paymentMethod = checkExistence("mobile", request.body.paymentMethod)

        //Adding loading zones to the results if the user is parking for 20min or less
        if (parkTime <= 20) {
            let loadingResults = db.run("SELECT ID, LONGITUDE, LATITUDE, STREET FROM LOADING_ZONES")

            for (let i=0; i<loadingResults.length; i++) {
                results.push(loadingResults[i])
            }
        }

        //Filtering
        for (let i=results.length-1; i>=0; i--) {

            if (vehicle === "motorcycle" && results[i].MC_BAYS === 0) {
                results.splice(i, 1)
            } else if (vehicle === "car" && results[i].VEH_BAYS === 0) {
                results.splice(i, 1)
            } else if (paymentMethod === "card" && results[i].CATEGORY === "PAY BY MOBILE APP ONLY ") {
                results.splice(i, 1)
            } else if (results.length < 4) {
                continue
            } else if (Math.abs(results[i].LONGITUDE - centreLong) > 0.0045) {
                results.splice(i, 1)
            } else if (Math.abs(results[i].LATITUDE - centreLat) > 0.0045) {
                results.splice(i, 1)
            }
        }

        //Finding the predicted occupancies/////////////////////////////////////////////

        //Creating a view MOBILES containing METER_NOs and MOBILE_ZONEs, so that
        //predicted occupancies could be selected based on meter number, date and hour.
        //This had to be done because PREDICTIONS only contains a foreign key with MOBILE_ZONES,
        //and not METERS.
        /*db.run(`CREATE VIEW MOBILES AS SELECT METERS.METER_NO, MOBILE_ZONES.ZONE FROM METERS JOIN MOBILE_ZONES ON MOBILE_ZONES.ZONE = METERS.MOBILE_ZONE`)*/
        
        //reformatting the date
        let dateArray = date.split("-")
        let newDate = dateArray[2] +"/"+ dateArray[1] +"/"+ dateArray[0]

        //determining the hour
        let time = Math.floor(arriveTime/100)

        //finding the occupancies
        let predictedOccupancies = []
        for (let i=0; i<results.length; i++) {
            let predictedOccupancy = db.run(`SELECT PREDICTIONS.OCCUPANCY_PRED AS PRED
                FROM PREDICTIONS
                JOIN MOBILES ON MOBILES.ZONE = PREDICTIONS.MOBILE_ZONE
                WHERE MOBILES.METER_NO = ?
                AND PREDICTIONS.DATE = ?
                AND PREDICTIONS.HOUR = ?`, [results[i].METER_NO, newDate, time])
            
            let predictionObject
            if (predictedOccupancy.length === 0) {
                predictionObject = {PRED:6, INDEX:i}
            } else {
                predictionObject = {PRED:predictedOccupancy[0].PRED, INDEX:i}
            }
            
            predictedOccupancies.push(predictionObject)
        }

        //Calculating the costs///////////////////////////////////////////////////////
        let costs = []
        for (let i=0; i<results.length; i++) {
            let meterID = results[i].METER_NO
            let costObject

            if (meterID === undefined) {
                costObject = {COST:0, INDEX:i}
            } else {
                let cost = priceCalc(meterID, arriveTime, leaveTime, date, vehicle, response)
                if (cost === '') {
                    cost = 0
                }
                cost = (Math.floor(cost*100))/100 //rounding to 2 decimal places

                costObject = {COST:cost, INDEX:i}
            }

            costs.push(costObject)
        }      

        //Sorting the results/////////////////////////////////////////////////////////
        sortedResults = []
        
        if (sortBy === "distance") {
            let distances = []
            for (let i=0; i<results.length; i++) {
                //finding distance between the centre and the current point
                //by using the formula for distance between two points
                let distanceValue = Math.sqrt(Math.pow(centreLong-results[i].LONGITUDE, 2)+Math.pow(centreLat-results[i].LATITUDE, 2))
                let distanceObject = {DISTANCE:distanceValue, INDEX:i}
                distances.push(distanceObject)
            }

            //sorting the distances
            distances.sort(compareDis)

            function compareDis(a,b) {
                if ( a.DISTANCE < b.DISTANCE ){
                    return -1
                }
                if ( a.DISTANCE > b.DISTANCE ){
                    return 1
                }
                return 0
            }

            //pushing the results that correspond with the sorted
            //distances into the sortedResults array
            for (let i=0; i<distances.length; i++) {
                let index = distances[i].INDEX
                let cost = "$"+ costs[index].COST
                let occ = predictedOccupancies[index].PRED

                let object = getResultsInfo(results, index, cost, occ)
                sortedResults.push(object)
            }

        } else if (sortBy === "cost") {
            //sorting the costs
            costs.sort(compareCosts)

            function compareCosts(a,b) {
                if ( a.COST < b.COST ){
                    return -1
                }
                if ( a.COST > b.COST ){
                    return 1
                }
                return 0
            }

            //pushing the results that correspond with the sorted
            //costs into the sortedResults array
            for (let i=0; i<costs.length; i++) {
                let index = costs[i].INDEX
                let cost = "$"+ costs[i].COST
                let occ = predictedOccupancies[index].PRED

                let object = getResultsInfo(results, index, cost, occ)
                sortedResults.push(object)
            }
    
        } else if (sortBy === "occupancy") {
            //sorting the occupancies
            predictedOccupancies.sort(compareOccs)

            function compareOccs(a,b) {
                if ( a.PRED < b.PRED ){
                    return -1
                }
                if ( a.PRED > b.PRED ){
                    return 1
                }
                return 0
            }

            //pushing the results that correspond with the sorted
            //occupancies into the sortedResults array
            for (let i=0; i<predictedOccupancies.length; i++) {
                let index = predictedOccupancies[i].INDEX
                let cost = "$"+ costs[index].COST
                let occ = predictedOccupancies[i].PRED

                let object = getResultsInfo(results, index, cost, occ)
                sortedResults.push(object)
            }
        }

        //Finding the points//////////////////////////////////////////////////////////
        let longitudes = []
        let latitudes = []
        let title = []
        for (let i=0; i<sortedResults.length; i++) {
            longitudes.push(sortedResults[i].LONGITUDE)
            latitudes.push(sortedResults[i].LATITUDE)
            title.push(`<a target="_self" href="/parkInfo?id=${i}">${sortedResults[i].OCCUPANCY}</a>`)
        }

        //Rendering the response/////////////////////////////////////////////////////
        response.render("results.hbs", {
            longitudes: longitudes,
            latitudes: latitudes,
            titles: JSON.stringify(title),

            centreLong: centreLong,
            centreLat: centreLat,
            centreZoom: centreZoom,

            vehicle: vehicle,
            paymentMethod: paymentMethod,
            sortBy: sortBy,

            sortedResults: sortedResults,
            results: results,
        })
    }
)

function checkExistence(variable, requested) {
    if (requested !== undefined) {
        return requested
    } else {
        return variable
    }
}

function priceCalc(meterID, arriveTime, leaveTime, date, vehicle, response) {
    //Retrieving data
    let costInfo = db.run("SELECT MOBILE_ZONES.TAR_RATE_WEEKDAY, MOBILE_ZONES.TAR_RATE_AH_WE, MOBILE_ZONES.MC_RATE FROM METERS JOIN MOBILE_ZONES ON MOBILE_ZONES.ZONE = METERS.MOBILE_ZONE WHERE METERS.METER_NO = ?", [meterID])

    let openTimes = db.run("SELECT TIMES.DAYS, TIMES.START, TIMES.END FROM METER_TIMES JOIN TIMES ON TIMES.ID = METER_TIMES.TIME_ID WHERE METER_TIMES.METER_NO = ?", [meterID])

    if (leaveTime <= arriveTime) {
        let error = "Invalid time input."
        renderHome(request, response, error)
        return
    }

    let cost = 0
    let newDate = new Date(date)
    let day = newDate.getDay()

    //Determining how much time will be spent in the parking space
    //while it is operational, by looping through each of the parking
    //space's open time slots
    for (let i=0; i<openTimes.length; i++) {

        //If it is the correct day for the time slot
        if ((openTimes[i].DAYS === "SAT-SUN" && (day===0 || day===6)) || (openTimes[i].DAYS === "MON-FRI" && (1<=day<=5))) {
            //Determining the number of hours in the time slot
            let openSlot = openTimes[i].END - openTimes[i].START
            //Taking the fact that time goes to 60s before switching over to the next hour into account:
            if (openSlot%100 !== 0 && (Math.floor((openTimes[i].END-(openTimes[i].START%100))/100) !== Math.floor(openTimes[i].END/100))) {
                openSlot = openSlot - 40
            }

            //Finding the number of operational meter hours the user
            //will be parking, from the start of their parking time
            //to the time that the meter closes
            let startDiff = openTimes[i].END - arriveTime
            let startHours = operationalHours(openSlot, startDiff, openTimes[i].END, arriveTime)

            //Finding the number of operational meter hours the user
            //will be parking, from the time that the meter opens
            //to the end of their parking time
            let endDiff = leaveTime - openTimes[i].START
            let endHours = operationalHours(openSlot, endDiff, leaveTime, openTimes[i].START)

            //Finding the total hours parked while the meter is operational
            let totalHours = Math.ceil(((startHours + endHours) - openSlot)/100)
            if (totalHours < 0) {
                totalHours = 0
            }

            //Finding how many of those hours are 7pm-10pm (after hour)
            let AHStartDiff = 2200 - arriveTime
            let AHStartHours = operationalHours(300, AHStartDiff, 2200, arriveTime)

            let AHEndDiff = leaveTime - 1900
            let AHEndHours = operationalHours(300, AHEndDiff, leaveTime, 1900)

            let AHTotalHours = Math.ceil(((AHStartHours + AHEndHours) - 300)/100)
            if (AHTotalHours < 0 || openTimes[i].END <= 1900 || openTimes[i].START >= 2200 || totalHours === 0) {
                AHTotalHours = 0
            }

            //Calculating the costs based on the determined hours of stay
            if (vehicle === "motorcycle") {
                cost = cost + (totalHours * costInfo[0].MC_RATE)
            } else if (day === 0 || day === 6) {
                cost = cost + (totalHours * costInfo[0].TAR_RATE_AH_WE)
            } else {
                if (AHTotalHours > 0 && costInfo[0].TAR_RATE_AH_WE !== '') {
                    cost = cost + (AHTotalHours * costInfo[0].TAR_RATE_AH_WE)
                    totalHours = totalHours - AHTotalHours
                }
                cost = cost + (totalHours * costInfo[0].TAR_RATE_WEEKDAY)
            }
        }
    }

    //Taking into account the max charge cap
    let maxCapChg = db.run("SELECT METER_NO, MAX_CAP_CHG FROM METERS WHERE METER_NO = ?", [meterID])

    if (maxCapChg[0].MAX_CAP_CHG !== '') {
        if (maxCapChg[0].MAX_CAP_CHG < cost) {
            cost = maxCapChg[0].MAX_CAP_CHG
        }
    }

    return cost
}

function getResultsInfo(results, index, cost, occ) {

    //where index is the index of the park in the results array
    let ID = "P"+ results[index].METER_NO
    let type = "parking"
    if (ID === "Pundefined") {
        ID = "L"+ results[index].ID
        type = "loading zone"
    }

    let street = results[index].STREET
    let long = results[index].LONGITUDE
    let lat = results[index].LATITUDE

    if (occ === 6) {
        occ = "Unknown availability"
    } else if (occ === 1 || occ === 0) {
        occ = "Very high availability"
    } else if (occ === 2) {
        occ = "High availability"
    } else if (occ === 3) {
        occ = "Medium availability"
    } else if (occ === 4) {
        occ = "Low availability"
    } else if (occ === 5) {
        occ = "Very low availability"
    }

    if (cost === "$0") {
        cost = "Free"
    }

    let object = {ID:ID, TYPE:type, STREET:street, OCCUPANCY:occ, COST:cost, LONGITUDE: long, LATITUDE: lat}
    return object
}

//Returns how many hours of 'diff' are within the operational 'timeSlot'
//Also diff = a-b
function operationalHours(timeSlot, diff, a, b) {
    //Once again considering that there are 60min in 1h, not 100min
    if (diff%100 !== 0 && (Math.floor((a-(b%100))/100) !== Math.floor(a/100))) {
        diff = diff - 40
    }

    if (diff <= 0) {
        return -2400
    } else {
        if (timeSlot - diff <= 0) {
            return timeSlot
        } else {
            return diff
        }
    }
}

app.all( //parkInfo
    '/parkInfo',
    function (request, response) {

        let parkID
        let parkOcc
        let parkCost

        //the "id" is whatever's after the ? in the url
        if (request.query.id) {
            //index is the index of the park in the sortedResults array
            let index = request.query.id

            parkID = sortedResults[index].ID
            parkOcc = sortedResults[index].OCCUPANCY
            parkCost = sortedResults[index].COST
        } else {
            parkID = request.body.parkID
            parkOcc = request.body.parkOcc
            parkCost = request.body.parkCost
        }

        let centreLong
        let centreLat
        let centreZoom

        //Getting all the information////////////////////////////////////////////////////
        let typeLetter = parkID.slice(0,1)
        parkID = parkID.slice(1, parkID.length)

        let typeName
        let info
        let costInfo
        let freeMins
        let paymentMethod
        let restrictions

        let costWeekday
        let costAH
        let costBikes

        if (typeLetter === "P") {
            typeName = "parking"
            info = db.run("SELECT LONGITUDE, LATITUDE, STREET, SUBURB, FREE_MINS, CATEGORY, VEH_BAYS, MC_BAYS, RESTRICTIONS, LOC_DESC, OPERATIONAL_DAY, OPERATIONAL_TIME, MAX_STAY_HRS, MOBILE_ZONE FROM METERS WHERE METER_NO = ?", [parkID])
            costInfo = db.run("SELECT MOBILE_ZONES.TAR_RATE_WEEKDAY, MOBILE_ZONES.TAR_RATE_AH_WE, MOBILE_ZONES.MC_RATE FROM METERS JOIN MOBILE_ZONES ON MOBILE_ZONES.ZONE = METERS.MOBILE_ZONE WHERE METERS.METER_NO = ?", [parkID])
        
            freeMins = "NOTE: Under " +info[0].FREE_MINS+ "min is FREE."
            if (info[0].FREE_MINS === '') {
                freeMins = ""
            }

            if (info[0].CATEGORY === "TICKETLESS METER MULTISPACE ") {
                paymentMethod = "Pay by card or mobile phone."
            } else if (info[0].CATEGORY === "PAY BY MOBILE APP ONLY ") {
                paymentMethod = "Pay by mobile phone only."
            }

            restrictions = info[0].RESTRICTIONS
            if (restrictions === 'NONE') {
                restrictions = "None."
            }

            costWeekday = "$"+costInfo[0].TAR_RATE_WEEKDAY
            costAH = "$"+costInfo[0].TAR_RATE_AH_WE
            if (costInfo[0].TAR_RATE_AH_WE === '') {
                costAH = "N/A"
            }
            costBikes = "$"+costInfo[0].MC_RATE
            if (costInfo[0].MC_RATE === '') {
                costBikes = "N/A"
            }

        } else if (typeLetter === "L") {
            typeName = "loading zone"
            info = db.run("SELECT LONGITUDE, LATITUDE, STREET, SUBURB, RESTRICTIONS, RESTRICTED_DAYS_AND_TIMES FROM LOADING_ZONES WHERE ID = ?", [parkID])
        }

        //Determining the centre coordinates and zoom////////////////////////////////////

        centreLong = info[0].LONGITUDE
        centreLat = info[0].LATITUDE
        centreZoom = 16.5

        let longitudes = []
        let latitudes = []
        let title = []
        for (let i=0; i<sortedResults.length; i++) {
            longitudes.push(sortedResults[i].LONGITUDE)
            latitudes.push(sortedResults[i].LATITUDE)
            title.push(`<a class="link" target="_self" href="/parkInfo?id=${i}">${sortedResults[i].OCCUPANCY}</a>`)
        }

        let infoObject = info[0]

        response.render("parkInfo.hbs", {
            longitudes: longitudes,
            latitudes: latitudes,
            titles: JSON.stringify(title),

            centreLong: centreLong,
            centreLat: centreLat,
            centreZoom: centreZoom,

            info: infoObject, //street, suburb, bays available, location description, operational times, max stay time
            typeName: typeName,
            parkOcc: parkOcc,
            parkCost: parkCost,
            freeMins: freeMins,
            paymentMethod: paymentMethod,
            restrictions: restrictions,

            costWeekday: costWeekday,
            costAH: costAH,
            costBikes: costBikes
        })
    }
)

app.all( //upload
    '/upload',
    function (request, response) {

        let confirm = ""

        if (request.body.uploaded !== undefined) {

            let file = request.files.datafile
            file.mv(
                './uploads/newData.csv',
                function (err) {
                    if (err) {
                        console.log(err)
                    } else {
                        //Reading and preparing the data
                        let data = fs.readFileSync("./uploads/newData.csv", "utf-8") //utf-8 is the type of data (text) as opposed to binary data
                        let dataLines = data.split("\r\n") //Splits the data into lines
                        let sql = "INSERT INTO PREDICTIONS (MOBILE_ZONE, DATE, HOUR, OCCUPANCY_PRED) VALUES (?,?,?,?)"

                        //Inserting the data into the database
                        db.run("BEGIN;")

                        for (let i=0; i<dataLines.length-1; i++) {
                            let line = dataLines[i]
                            let info = line.split(",")
                            
                            console.log(info)
                            if (info.length !== 4) {
                                continue
                            }

                            console.log(sql,info)
                            //db.run(sql,info)
                            console.log("RAN")
                        }

                        db.run("COMMIT;")
                    }
                }
            )
            
            //let results = db.run("SELECT * FROM PREDICTIONS WHERE DATE = ?", ["2/04/2023"])
            //console.log(results)
            confirm = "Upload successful!"
        }

        response.render("upload.hbs", {
            confirm: confirm
        })
    }
)
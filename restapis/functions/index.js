'use strict';

/* eslint-disable promise/no-nesting */
const admin = require('firebase-admin');

const functions = require('firebase-functions');
admin.initializeApp();
const express = require('express');
const app = express();


let db = admin.firestore();
let usersRef = db.collection("Users");
let emerRef = admin.firestore().collection("Emergencies");
let linkRef = db.collection("Links");
let ambuRef = db.collection("Ambulance");
let answerRef = db.collection("Answers");
let smsRef = db.collection("SMS");
const bodyParser = require('body-parser');

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended:false}))

const genId = function(){
    const id = Math.random().toString(36).slice(-8)
    return id;
}

app.get('/login/:id', async(req,res) => {
    try{
        const user = usersRef.doc(req.params.id);
        const link = linkRef.doc(req.params.id);
        await link.update({
            isSent: true
        });
        await user.update({
            checkpoint:"Entered"
        });
        res.status(200).send("User entered the link. Please use the link below to set user privacy.\n https://us-central1-covid19-test-a70c0.cloudfunctions.net/user/consent-agreement/"+req.params.id+' Using PUT method.');
    }
    catch(err){
        res.status(500).send(err);
    }
    
})



app.get('/login-terms-agreements/:id', async(req,res) => {
    try{
        const id = req.params.id;
        const emergency = emerRef.doc(id);
        const ambulance = ambuRef.doc(id);
        //const question = await questionRef.get()
        let emerdata = await emergency.get();
        let ambdata = await ambulance.get();
        let emerres = emerdata.data();
        let amdres = ambdata.data();
        
        res.send({
            Message:'Get data sucessful, Past link in POST method to answer the questions : https://us-central1-covid19-test-a70c0.cloudfunctions.net/user/check-point?val=red&?uid='+id,
            Emergencies: emerres,
            Ambulance: amdres,
            Question:"First Question"
        });

    }
    catch(err){
        res.status(500).send(err);
    }
    
})



app.post('/add',async (req,res) => {
    try{
        
        const uid = genId();
        const user = {
            phone: req.body.user,
            consentPrivacy: false,
            date: new Date(),
            checkpoint:""
        }
        const emergency = {
            userId: uid,
            loc:"location",
            date: new Date()
        }
        const link = {
            userId: uid,
            date: new Date(),
            isSent: false,
            expiration: null
        }
        const ambulance ={
            userId: uid,
            emergenciesId: uid,
            arrivedTime : null,
            checkpoint: null,
            criticalLevel: null,
            isCovid: null,
            rejectedTime: null,
            status: "Submitted",
            submitTime: new Date(),
            sentTime: null
        }

        await usersRef.doc(uid).set(user);
        await emerRef.doc(uid).set(emergency);
        await linkRef.doc(uid).set(link);
        await ambuRef.doc(uid).set(ambulance);

        res.send('Create user successful, Please copy the links below. \n https://us-central1-covid19-test-a70c0.cloudfunctions.net/user/login/'+uid+'\n Paste link in GET method and run.');

    } catch (err){
        res.send(err.message);
    }

})

app.post('/check-point', async (req,res) => {
    /*{
            "answers" : [
                  {
                     questionId: "",
                     criticalLevel: "",
                     answer:"",
                     ... 
                  },
                  ...
           ]
        }*/
    try{
        const val = req.query.val;
        const userid = req.query.uid;
        let user = usersRef.doc(userid);
        await user.update({
            checkpoint:val
        });
        const answer = req.body.answers;
        const answerdata ={
            answer,
            userId: userid,
            emergencyId: userid,
            questionedTime: new Date(),
            answeredTime: new Date()
        }
        await answerRef.doc(userid).set(answerdata);

        let ambulance = ambuRef.doc(userid);
        await ambulance.update({
            status:"Submitted"
        });

        res.status(200).send({IfDone:"https://us-central1-covid19-test-a70c0.cloudfunctions.net/user/request-ambulance/"+userid+" PUT method to request ambulance" ,value : val, id: userid, Answer: answerdata});
    }catch (err) {
        res.status(500).send(err.massage);
    }
})

app.put('/consent-agreement/:id', async (req,res) => {
    try{
        const uid = req.params.id;
        const user = usersRef.doc(uid);
        await user.update({
            consentPrivacy: true
        });
        res.status(200).send('Use the links below to get previews question. \n https://us-central1-covid19-test-a70c0.cloudfunctions.net/user/login-terms-agreements/'+uid+'\n Paste link in GET method and run.');
    }
    catch(err){
        res.status(500).send(err.message);
    }
    
})

app.put('/complete-tracking/:id', async (req,res) => {
    try{
        const ambulance = ambuRef.doc(req.params.id);
        await ambulance.update({
            status:"Arrived",
            checkpoint:"Confirmation"
        });
        const user = usersRef.doc(req.params.id);
        await user.update({
            checkpoint:"Confirmation"
        });
        res.status(200).send("You're done. \n Use https://us-central1-covid19-test-a70c0.cloudfunctions.net/user"+req.params.id+" DELETE method to delete user.");
    }
    catch(err){
        res.status(500).send(err);
    }
    
})

app.put('/request-ambulance/:id', async (req,res) => {
    try{
        const id = req.params.id;
        const emergency = (await emerRef.doc(id).get()).data();
        const ambulance = await ambuRef.doc(id);
        
        await ambulance.update({
            EmergencyDetail:emergency
        })

        res.status(200).send({Message:"You're requesting for the ambulance, Use https://us-central1-covid19-test-a70c0.cloudfunctions.net/user/complete-tracking/"+id+" PUT method to complete tracking the ambulance.",Status:(await ambulance.get()).data()})

    }
    catch(err){
        res.status(500).send(err.message);
        
    }
    
})

app.delete('/:id', async (req,res) => {
    const uid = req.params.id;
    let result = Result();

    usersRef.doc(uid).delete().then(user => {
        linkRef.doc(uid).delete().then(link => {
            emerRef.doc(uid).delete().then(emer => {
                ambuRef.doc(uid).delete().then(ambu => {
                    answerRef.doc(uid).delete().then(answer => {
                        result.success = true
                        result.response ='Deleted successfully'
                        res.send(result)
                        return
                    }).catch(error => {
                        result.error = Error(97, 'Connection failed')
                        res.send(result)
                        return
                    });
                    return

                }).catch(error => {
                    result.error = Error(97, 'Connection failed')
                    res.send(result)
                    return
                });
                return

            }).catch(error => {
                result.error = Error(97, 'Connection failed')
                res.send(result)
                return
            });
            return

        }).catch(error => {
            result.error = Error(97, 'Connection failed')
            res.send(result)
            return
        });
        return
    }).catch(error => {
        result.error = Error(97, 'Connection failed')
        res.send(result)
        return
    });
});

exports.user = functions.https.onRequest(app);
exports.admin = functions.https.onRequest(api);

var Result = function(){
    return {
        success: false,
        response: null,
        error: null
    }
}

var Error = function(code, msg){
    return {
        code: code,
        msg: msg
    }
}

api.delete('delete-user/:id', async (req,res) => {
    const uid = req.params.id;
    let result = Result();

    usersRef.doc(uid).delete().then(user => {
        linkRef.doc(uid).delete().then(link => {
            emerRef.doc(uid).delete().then(emer => {
                ambuRef.doc(uid).delete().then(ambu => {
                    answerRef.doc(uid).delete().then(answer => {
                        result.success = true
                        result.response ='Deleted successfully'
                        res.send(result)
                        return
                    }).catch(error => {
                        result.error = Error(97, 'Connection failed')
                        res.send(result)
                        return
                    });
                    return

                }).catch(error => {
                    result.error = Error(97, 'Connection failed')
                    res.send(result)
                    return
                });
                return

            }).catch(error => {
                result.error = Error(97, 'Connection failed')
                res.send(result)
                return
            });
            return

        }).catch(error => {
            result.error = Error(97, 'Connection failed')
            res.send(result)
            return
        });
        return
    }).catch(error => {
        result.error = Error(97, 'Connection failed')
        res.send(result)
        return
    });
});

api.post('/gen-user',async (req,res) => {
    try{
        
        const uid = genId();
        const user = {
            phone: req.body.user,
            consentPrivacy: false,
            date: new Date(),
            checkpoint:""
        }
        const emergency = {
            userId: uid,
            loc:"location",
            date: new Date()
        }
        const link = {
            userId: uid,
            date: new Date(),
            isSent: false,
            expiration: null
        }
        const ambulance ={
            userId: uid,
            emergenciesId: uid,
            arrivedTime : null,
            checkpoint: null,
            criticalLevel: null,
            isCovid: null,
            rejectedTime: null,
            status: "Submitted",
            submitTime: new Date(),
            sentTime: null
        }

        await usersRef.doc(uid).set(user);
        await emerRef.doc(uid).set(emergency);
        await linkRef.doc(uid).set(link);
        await ambuRef.doc(uid).set(ambulance);

        res.send('Create user successful');

    } catch (err){
        res.send(err.message);
    }

})

api.put('/send-ambulance/:id'), async (req,res) => {
    let id = req.params.id
    let ambulance = ambuRef.doc(id)
    await ambulance.update ({
        status:"Sent"
    })

    res.status(200).send('Sent ambulance successful')

}

api.post('/send-sms/:id', async (req,res) => {
    /*{
            "telNo" : "123146547",
            "sms" : "Messages"
        }*/
        try{
            const telNo = req.body.telNo;
            const massage = req.body.sms;
            const userid = req.params.id;
            let sms = smsRef.doc(userid);
            await sms.set({
                telephone: telNo,
                Massage:massage
            });
    
            res.status(200).send('SMS sent successful');
        }catch (err) {
            res.status(500).send(err.massage);
        }

})
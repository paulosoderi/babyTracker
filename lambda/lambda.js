// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
const randomBytes = require('crypto').randomBytes;
const AWS = require('aws-sdk');
const ddb = new AWS.DynamoDB.DocumentClient();

exports.handler = (event, context, callback) => {
    
    //for simplification, and because this will be used only by me, I made a quick check to know the different payloads. Ideally, a lambda wrapper should be created for each service 
    //and then call a "core" functionally lambda to perform the common action. 
    var isIot = false;
    if (event.body !== undefined) {
        //console.log('Lambda function was triggered by an API GATEWAY');
        isIot = false;
      } else {
        //console.log('Lambda function was triggered by IOT event');
        isIot = true;
      }
  
    var activity_log_user = "";
    
    if(!isIot){
        if(!event.requestContext.authorizer) {
            errorResponse('Authorization not configured', context.awsRequestId, callback);
            return;
        }else{
              activity_log_user = event.requestContext.authorizer.claims['email'];
            }
    }else{
        activity_log_user = "ARDUINO";
    }

    const activity_id = toUrlString(randomBytes(16));
    var requestBody = "";
    if(isIot){
        requestBody = event;
    }else{
        requestBody = JSON.parse(event.body);
    }
   
    const activity_log_source = requestBody.activity_log_source;
    const activity_type_lvl1 = requestBody.activity_type_lvl1;
    const activity_type_lvl2 = requestBody.activity_type_lvl2;
    const activity_type_lvl3 = requestBody.activity_type_lvl3;
    const duration = requestBody.duration;

    const activity_start_time = new Date().toISOString();
    console.log('Start activity time' ,activity_start_time);
    

    logBabyActivity(activity_id, 
                    activity_log_source,
                    activity_log_user, 
                    activity_type_lvl1, 
                    activity_type_lvl2,
                    activity_type_lvl3,
                    activity_start_time,
                    duration).then(() => {
        // You can use the callback function to provide a return value from your Node.js
        // Lambda functions. The first parameter is used for failed invocations. The
        // second parameter specifies the result data of the invocation.

        // Because this Lambda function is called by an API Gateway proxy integration
        // the result object must use the following structure.
        callback(null, {
            statusCode: 201,
            body: JSON.stringify({
                message: "activity logged"
            }),
            headers: {
                'Access-Control-Allow-Origin': '*',
            },
        });
    }).catch((err) => {
        console.error(err);

        // If there is an error during processing, catch it and return
        // from the Lambda function successfully. Specify a 500 HTTP status
        // code and provide an error message in the body. This will provide a
        // more meaningful error response to the end client.
        errorResponse(err.message, context.awsRequestId, callback)
    });
};


function logBabyActivity(activity_id, activity_log_source, activity_log_user, activity_type_lvl1, activity_type_lvl2,activity_type_lvl3,activity_start_time, duration) {
    return ddb.put({
        TableName: 'baby_activity_transaction',
        Item: {
            activity_id: activity_id,
            activity_log_source: activity_log_source,
            activity_log_user: activity_log_user,
            activity_type_lvl1: activity_type_lvl1,
            activity_type_lvl2: activity_type_lvl2,
            activity_type_lvl3: activity_type_lvl3,
            activity_start_time: activity_start_time,
            duration: duration
        },
    }).promise();
}

function toUrlString(buffer) {
    return buffer.toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');
}

function errorResponse(errorMessage, awsRequestId, callback) {
  callback(null, {
    statusCode: 500,
    body: JSON.stringify({
      Error: errorMessage,
      Reference: awsRequestId,
    }),
    headers: {
      'Access-Control-Allow-Origin': '*',
    },
  });
}
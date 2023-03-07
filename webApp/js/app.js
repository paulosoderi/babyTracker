var BabyActivityTracker = window.BabyActivityTracker || {};

(function babyTrackerScopeWrapper($) {
    var authToken;
    BabyActivityTracker.authToken.then(function setAuthToken(token) {
        if (token) {
            authToken = token;
        } else {
            window.location.href = 'index.html';
        }
    }).catch(function handleTokenError(error) {
        alert(error);
        window.location.href = 'index.html';
    });

    // Register click handler for #request button
    $(function onDocReady() {
        //assign function to button click
        $('#request').click(handleRequestClick);

       //assing change function to the radios to show/hide each level
       $("input[name=1stLevelOptions]").on( "change", function() {
        var idSelectedRadio = $(this).get(0).id;
        displayLevel2Options(idSelectedRadio);
       } );

       $("input[name=2ndLevelOptions]").on( "change", function() {
        var idSelectedRadio = $(this).get(0).id;
        displayLevel3Options(idSelectedRadio);
       } );

       //get authorization token
        BabyActivityTracker.authToken.then(function updateAuthMessage(token) {
            if (token) {
                displayUpdate('You are authenticated. You can log activities.');
            }else{
                displayUpdate('Not authenticated, please login <a href="index.html">here</a>.');
            }
        });

    });

    //function to log baby activity, it will get the optionse selected in the screen and call the AWS API
    function logBabyActivity() {
       //reset variables
       var activity_type_lvl1 = "";
       var activity_type_lvl2 = "";
       var activity_type_lvl3 = "";
       var duration = 0;

       
        //first we need to very if first radio is selected, that`s the only mandatory radio, if not, show error message
        if( $("input[name=1stLevelOptions]:checked").length == 0){
            $('#errorMessageText').text("Please select at least one activity");
            $('#errorMessage').show();
            return false;
        }

        //all other activities are not mandatory, sow e will simple populate the json or not
        //hardcoded, indicate the source of the activity, it will always be API from the app.
        var activity_log_source = "API";

        //get level 1 activity
        activity_type_lvl1 = $("input[name=1stLevelOptions]:checked").length > 0 ? $("input[name=1stLevelOptions]:checked").get(0).id : "";
        activity_type_lvl2 = $("input[name=2ndLevelOptions]:checked").length > 0 ? $("input[name=2ndLevelOptions]:checked").get(0).id : "";
        activity_type_lvl3 = $("input[name=3rdLevelOptions]:checked").length > 0 ? $("input[name=3rdLevelOptions]:checked").get(0).id : "";

        //check if first level is a one time thing or has duration to set duration
        //this API is a plan B, duration will be estimated and informed by the user, we are not tracking the duration here
        if ( activity_type_lvl1 !== "diaper" && activity_type_lvl1 !== "feed" && activity_type_lvl1 !== "pump"){
            //translate the duraiton from the ID to seconds to send to the api
            duration = translateDuration($("input[name=2ndLevelOptions]:checked").get(0).id)
        }else{
            duration = 0;
        }

        //call the API
        $.ajax({
            method: 'POST',
            url: _config.api.invokeUrl + '/activity',
            headers: {
               Authorization: authToken
            },
            data: JSON.stringify(
                {
                    activity_log_source: activity_log_source,
                    activity_type_lvl1: activity_type_lvl1,
                    activity_type_lvl2: activity_type_lvl2,
                    activity_type_lvl3: activity_type_lvl3,
                    duration: duration
                }
            ),
            contentType: 'application/json',
            success: completeRequest,
            error: function ajaxError(jqXHR, textStatus, errorThrown) {
                console.error('Error requesting ride: ', textStatus, ', Details: ', errorThrown);
                console.error('Response: ', jqXHR.responseText);
                $('#errorMessageText').text('Response: ', jqXHR.responseText);
                $('#errorMessage').show();
                //alert('An error occured \n' + jqXHR.responseText);
            }
        });
    }

    function displayUpdate(text) {
        $('#updates').append($('<li>' + text + '</li>'));
    }

    function handleRequestClick(event) {
        event.preventDefault();
        logBabyActivity();
    }

    function hideAllRadioButton(){        
        $('#diaperOptions').hide();
        $('#feedOptions').hide();
        $('#timeOptions').hide();
        $('#pumpOptions').hide();   
    }

    function completeRequest(result) {
        console.log('Response received from API: ', result);
        $('#updates').append($('<li>' + new Date().toLocaleString() + ' Activity succesfully logged' + '</li>'));
        $('#errorMessage').hide();
        hideAllRadioButton()
    }

    function displayLevel2Options(radioSelected) {
        $('#errorMessage').hide();
        hideAllRadioButton()

        //reset level 2 and 3 radios
        $("input[name=2ndLevelOptions]:checked").prop('checked', false);
        $("input[name=3rdLevelOptions]:checked").prop('checked', false);

        if (radioSelected !== "diaper" && radioSelected !== "feed" && radioSelected !== "pump"){
            $('#timeOptions').show();
        }else{
            $('#'+radioSelected+'Options').show();
        }  
    }

    function displayLevel3Options(radioSelected) {
        //reset level 3 radios
        $("input[name=3rdLevelOptions]:checked").prop('checked', false);
        
        $('#breastOptions').hide();
        $('#'+radioSelected+'Options').show();
    }

    //translate duration to seconds
    function translateDuration(id ){
       switch(id) {
            case "10_min":
                return 600;
                break;
            case "20_min":
                return 1200;
                break;
            case "30_min":
                return 1800;
                break;
            case "40_min":
                return 2400;
                break;
            case "50_min":
                return 3000;
                break;
            case "1_hour":
                return 3600;
                break;
    }
}

}(jQuery));



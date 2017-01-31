
// ==UserScript==
// @name         TagPro ELTP group settings dev
// @version      0.1
// @description  Sets default ELTP group settings, maps and also remaining time in case of break request
// @author       zeeres
// @include      http://tagpro-*.koalabeast.com*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_deleteValue
// @grant        GM_addStyle
// ==/UserScript==

var timeNow = Date.now();
var maps = ["EMERALD", "Pilot", "Market", "Transilio", "Atomic", "IRON", "Rush", "Curb", "Pilot"];
var eltp_start = 1477094400*1000;  // Week 0: ENLTP
var time = (timeNow-eltp_start)/(7*24*60*60*1000);
var week = 0;
function set_week() {
    week = Math.floor(time);  // We are in this week now
}
set_week();


var default_data = {stored: true, active: true, map: '', time: 10, caps: 0, half: 1, lastbrcall: 0, lastbrcall_team: 0, brcall_team1: 0, brcall_team2: 0, me: '', leader: false};  // default data

class Settings {
    constructor(data) {
        this.prefix = 'TPELTP_';
        if (GM_getValue(this.prefix+'stored') === undefined) {   // never stored values yet
            this.data = data;
            this.store_all();
        } else {
            this.data = {};
            for (var d in default_data) {
                this.data[d] = GM_getValue(this.prefix+d);
            }
        }
    }
    set(variable, value) {
        this.data[variable] = value;
        GM_setValue(this.prefix+variable, value);
    }
    delete(variable) {
        delete this.data[variable];
        GM_deleteValue(this.prefix+variable);
    }
    get(variable) {
        var value = GM_getValue(this.prefix+variable);
        var keys = Object.keys(default_data);
        var found = false;
        for(var i = 0; i < keys.length; i++) {
            if (keys[i] === variable) found = true;
        }
        if (value === undefined && !found) {
            this.set(variable, default_data[variable]);
            return default_data[variable];
        } else return value;
    }
    store_all() {
        for (var d in this.data) {
            GM_setValue(this.prefix+d, this.data[d]);
        }
    }
    log_all() {
        for (var d in this.data) {
            console.log(d + ': ' + this.data[d]);
        }
    }
    delete_all() {
        for (var d in this.data) {
            GM_deleteValue(this.prefix+d);
        }
    }
}

function ObjectIndexOf(myArray, property, searchTerm) {  // searches for a property in a {}-object
    for(var i = 0, len = myArray.length; i < len; i++) {
        if (myArray[i][property] === searchTerm) return i;
    }
    return -1;
}

var WhereAmI = function(){
    if (window.location.port) {
        return('game');
    } else if (window.location.pathname.startsWith('/groups/')) {
        return('group');
    } else if (window.location.pathname.startsWith('/games/find')) {
        return('joining');
    } else if (window.location.pathname.startsWith('/profile/')) {
        if ($('#saveSettings').length) {
            return('myprofile'); // my profile page (logged in)
        } else {
            return('notmyprofile'); // not my profile page, or not logged in
        }
    } else {
        return('elsewhere');
    }
};

var IAmIn = WhereAmI();
var settings = new Settings(default_data);
// settings.delete_all();
// settings = new Settings(default_data);

function setup() {
    console.log('setup');
    // Sets up the button and calls activate and deactivate functions if checkbox is changed

    var $pull_right = $('.group-settings');  // Element where the "ELTP Group" is placed
    //var text_checked = '';
    //if (GM_getValue('ELTP_activated')) $text_checked = ' checked = "checked"';

    // $pull_right.append('<label class="btn btn-primary group-setting" id="eltplabel"><input type="checkbox" class="js-socket-public" name="ELTPGame"' + text_checked + '>ELTP Group</label');
    // $pull_right.append('<label class="btn btn-primary group-setting" id="tpeltplabel"><input type="checkbox" class="js-socket-public" name="ELTPGame">ELTP Group</label>');
    $('<div id="tpeltp" class="col-md-12 private-game"><div id="tpeltp_group" class="player-group"><div id="tpeltp_header" class="player-group-header" style="background: #cddc39; color: #fff;"><div class="team-name">ELTP Group</div><div class="team-score pull-right"><label class="btn btn-default" id="tpeltp_switch"><input type="checkbox" class="js-socket-public" name="tpeltp_active"> active</label></div><div class="clearfix"></div></div><ul style="background: #353535; border-radius: 0 0 3px 3px; border: 1px solid #404040; border-top: 1px solid #2b2b2b; padding: 10px; overflow-y: auto;"><div id="tpeltp_div" class="col-md-6 private-game" style="width: 100%;"></div></ul></div></div>').insertBefore('#red-team');
    $('input[name="tpeltp_active"]').prop('checked', settings.get('active'));
    $('input[name="tpeltp_active"]').change(function() {  // when the "ELTP group" button is pushed
        settings.set('active', this.checked);
        if (this.checked) {  // if button is activated, activate default settings for the week
            save_settings();
            reset_brcalls();
            activate();
            settings.set('active', true);
        } else {
            settings.set('active', false);
            restore_prev_settings();
            reset_brcalls();
            deactivate();
        }
    });

    // week buttons
    console.log(week);
    $('#tpeltp_div').append('Week <label class="btn btn-default"><input type="radio" name="tpeltp_week" value="0">0</label>');
    for (var i = 1; i < maps.length-1; i++) {  // -1 bc we are starting from 1 and another -1 bc last map doesn't count as a new week
        $('#tpeltp_div').append('<label class="btn btn-default"><input type="radio" name="tpeltp_week" value="'+i+'">'+i+'</label>');
    }
    if (week < maps.length-1) $('#tpeltp_div input[name="tpeltp_week"][value="' + week + '"]').prop("checked", true);
    $('input[name="tpeltp_week"]').change(function() {  // when one of the "week" buttons is pushed
        week = $(this).prop('value');
        set_map();
    });

    $('#tpeltp_div').append('<br>');

    // half buttons
    $('#tpeltp_div').append('Half <label class="btn btn-default"><input type="radio" name="tpeltp_half" value="1">1</label>');
    $('#tpeltp_div').append('<label class="btn btn-default"><input type="radio" name="tpeltp_half" value="2">2</label>');
    $('#tpeltp_div').append('<label class="btn btn-default"><input type="radio" name="tpeltp_half" value="3">3</label>');
    $('#tpeltp_div').append('<label class="btn btn-default"><input type="radio" name="tpeltp_half" value="4">4</label>');
    $('#tpeltp_div input[name="tpeltp_half"][value="' + settings.get('half') + '"]').prop("checked", true);
    $('input[name="tpeltp_half"]').change(function() {  // when one of the "half" buttons is pushed
        settings.set('half', $(this).prop('value'));
        set_map();
    });

    if (settings.get('active')) {  // if script was activated and page was either refreshed or
        console.log('is_activated');
        activate();
        $('input[name="ELTPGame"]').prop('checked', true);
        var brcalltime = settings.get('lastbrcall');

        if (brcalltime > 0) {  // if break was called
            console.log('brcalled');
            var teams = ['redTeamName', 'blueTeamName'];
            var brteam = 0;
            if (settings.get('brcall_team1') > 0) {
                brteam = 1;
            } else if (settings.get('brcall_team2') > 0) {
                brteam = 2;
            } else {
                console.log('ELTP_GS: wtf happened here :<');
            }

            var team_called = settings.get('lastbrcall_team');
            console.log('team_called: ' + team_called);
            var capDiff = settings.get('capDiff');
            console.log('capDiff: ' + capDiff);
            var round_up = 0;
            if (team_called == 1 && capDiff > 0 || team_called == 2 && capDiff < 0) {  // only rounding up if the winning team calls the br
                round_up = 1;
            }
            // if (GM_getValue('ELTP_capDiff') > 0) {
            //     if (GM_getValue('ELTP_lastbrcall_team') == 1) {
            //     } else if (GM_getValue('ELTP_lastbrcall_team') == 2) {
            //     }
            // }
            var newgameminutes = (round_up === 0)?(Math.floor(brcalltime / 60)):(Math.ceil(brcalltime / 60));
            var winningteam = 0;
            if (capDiff > 0) {
                winningteam = 1;
            } else if (capDiff < 0) {
                winningteam = 2;
            }
            console.log('winningteam: ' + winningteam);
            var message = settings.get(teams[brteam-1]) + ' called BR at ' + pretty_remaining(settings.get('lastbrcall')) + ', ';
            console.log(message);
            message += (winningteam > 0)?(GM_getValue('ELTP_team' + teams[winningteam-1]) + ' was winning'):('caps were even');
            console.log(message);
            message += ', so I\'ll round ';
            console.log(message);
            message += (round_up > 0)?('up'):('down');
            console.log(message);
            message += ' to ' + newgameminutes + ' Minutes';
            console.log(message);
            tagpro.group.socket.emit("chat", message);
            settings.set('lastbrcall', 0);  // reset last br call
            settings.set('lastbrcall_team', 0);
            if ((newgameminutes === 0)) {
                next_half();  // proceed to next half if there's no minutes left
            } else {
                tagpro.group.socket.emit("setting", {"name": "time", "value": newgameminutes});
            }
        }
        // default_settings();
        listeners();  // start the listeners
    } else {
        deactivate();
        GM_setValue('ELTP_half', 1);
    }
}

// Save the group settings for later
function save_settings() {
    settings.set('map', $('select[name="map"] option:selected').attr('value'));
    settings.set('time', $('select[name="time"] option:selected').attr('value'));
    settings.set('caps', $('select[name="caps"] option:selected').attr('value'));

    /* var select_settings = [];
    $('.form-control.js-customize option').each(function(i, obj) { // get all the available settings in the select-box
        select_settings.push($(obj).attr('value'));
    });

    for(var i = 0; i < select_settings.length; i++) {  // get the value for each of the settings and store it
        if (select_settings[i] === '') continue;
        var val = '';
        val = $('select[name="' + select_settings[i] + '"] option:selected').attr('value');
        if (val === undefined) {  // no selectbox, but a checkbox
            val = $('input[name="' + select_settings[i] + '"]')[0].checked;
        }
        select_settings[i] = val;
    }

    $('.non-default.col-md-12').each(function(i, obj) {
        select_settings[$(obj).attr('name')] = true;
    });
    settings.set('select_settings', select_settings);*/
}

// Deactivate
function deactivate() {
    settings.set('half', 1);
    reset_brcalls();
    console.log('TagPro ELTP Group settings deactivated');
    $("#tpeltp_div").hide();
    $("#tpeltp_header").css('background', '#919c28');
}

// Restore the settings from before the button was activated
function restore_prev_settings() {
    tagpro.group.socket.emit("setting", {"name": "map", "value": settings.get('map')});
    tagpro.group.socket.emit("setting", {"name": "time", "value": settings.get('time')});
    tagpro.group.socket.emit("setting", {"name": "caps", "value": settings.get('caps')});

    /* var settings = GM_getValue('ELTP_settings');
    for(var i = 0; i < settings.length; i++) {
        tagpro.group.socket.emit("setting", {"name": settings[i].name, "value": GM_getValue('ELTP_' + settings[i])});
    }*/
}

// Sets the map for the current week/half
function set_map() {
    tagpro.group.socket.emit("setting", {"name": "map", "value": maps[(settings.get('half') > 2)?(parseInt(week)+1):week]});  // if in second game, use the next map
}

// Set the default settings
function default_settings() {
    // console.log('default_settings');
    // $('select[name="time"]').val(10);
    // $('select[name="caps"]').val(0);
    // console.log('week: '+week);
    set_map();
    tagpro.group.socket.emit("setting", {"name": "time", "value": 10});
    tagpro.group.socket.emit("setting", {"name": "caps", "value": 0});
    // tagpro.group.socket.emit("setting", {"name": "buffDelay", "value": true});
}

// Activate
function activate() {
    console.log('TagPro ELTP Group settings activated');
    default_settings();
    $("#tpeltp_div").show();
    $("#tpeltp_header").css('background', '#cddc39');
}

// reset br calls variables
function reset_brcalls() {
    // reset br calls for both teams
    settings.set('lastbrcall', 0);
    settings.set('lastbrcall_team', 0);
    settings.set('brcall_team1', 0);
    settings.set('brcall_team2', 0);
}

// next Half
function next_half() {
    settings.set('half', settings.get('half')+1);
    reset_brcalls();
    default_settings();  // sets new map (if half > 2)
}

function listeners() {
    tagpro.group.socket.on('you', function(data) {
        settings.set('me', data);
        //console.log('me'+data);
    });

    tagpro.group.socket.on('member', function(member) {
        if (member.id == settings.get('me')) {
            if (member.leader) {
                settings.set('leader', true);
                // activated = true;
                // if (!activated) {
                //    activate();
                // }
            } else {  // if we aren't the leader (anymore), deactivate
                settings.set('leader', false);
                if (settings.get('activated')) {
                    activated = false;
                    deactivate();
                }
            }
        }
    });

    // console.log(tagpro.group.socket);
    tagpro.group.socket.on('setting',function(data) {
            settings.set(data.name, data.value);
    });

    // save last cap time to determine if the cap was in the 20 seconds after br was called
}

// round to specified decimal places
function round_places(number, places) {
  return +(Math.round(number + "e+" + places)  + "e-" + places);
}

// print pretty remaining time
function pretty_remaining(time) {
    return (time > 0)?(Math.floor(time / 60) + ':' + Math.round((time % 60))):'0:00';
}

// when br is called
function chat_br(chat) {
    var breakcallat = 0;
    var team = 0;
    var message = '';
    console.log('br chat.from: ' + chat.from);
    for (var playerId in tagpro.players) {
         console.log('playerId: ' + playerId + ', playerTeam: ' + tagpro.players[playerId].team);
        if (playerId == chat.from) {
            team = tagpro.players[playerId].team;
        }
    }
    console.log('team: ' + team);
    console.log('brcall_team'+team+': ' + settings.get('brcall_team' + team));
    if (settings.get('brcall_team' + team) > 0) {  // team already used br in this half
        message = 'Sorry, but you used your BR for this half already. Keep playing!';
        tagpro.group.socket.emit("chat", message);
    } else {
        settings.set('brcall_team' + team, 1);  // save team that called br
        var fullTime = Date.parse(tagpro.gameEndsAt); // expected end of game
        console.log('fullTime: ' + fullTime);
        var time = Date.now(); // time of br call
        console.log('time: ' + time);
        breakcallat = (fullTime-time)/1000;
        console.log('breakcallat: ' + breakcallat);
        console.log('ELTP_lastbrcall: ' + settings.get('lastbrcall'));
        var lastbrcall = settings.get('lastbrcall');
        var saved_breakcallat = (fullTime-lastbrcall)/1000;
        var text_breakcallat = pretty_remaining(breakcallat);
        var text_breakcallatm20 = pretty_remaining(breakcallat-20);
        console.log('breakcallat-20: ' + round_places(breakcallat-20, 3));
        console.log('saved_breakcallat: ' + round_places(saved_breakcallat, 3));
        if ((lastbrcall > 0) && ((breakcallat-20) < ((fullTime-settings.get('lastbrcall'))/1000))) {
            message = 'BR was already called, STOP at ' + pretty_remaining(saved_breakcallat-20) + ' or next cap';
        } else {
            settings.set('lastbrcall', breakcallat);
            settings.set('lastbrcall_team', team);
            message = 'BR was called, STOP at ' + text_breakcallatm20 + ' or next cap';
        }
        tagpro.group.socket.emit("chat", message);  // send br message to group chat
    }
    return breakcallat;
}


if(IAmIn === 'group') { // group page
    var init = false;
    var activated = true;

    tagpro.group.socket.on('private',function(priv) {
        if(priv.isPrivate && !init) {
            setup();
            init = true;
        }
    });
} else if (IAmIn === 'game') {
    tagpro.ready(function() {
        // console.log('test');
        tagpro.socket.on('chat', function(chat){
            if (chat.message.trim().toLowerCase() === "br") {  // br was called
                chat_br(chat);
                // TODO: after 20+ secs, return to group page
                /*function waitForInitialized(fn) {
                    if (!tagpro) {
                        setTimeout(function() {
                            waitForInitialized(fn);
                        }, 10);
                    } else {
                        fn();
                    }
                }*/
            }
        });

        tagpro.socket.on('sound', function(data) {  // there was a cap
            if (data.s === 'cheering' || data.s === 'sigh') {
                console.log('cap');
                var fullTime = Date.parse(tagpro.gameEndsAt); // expected end of game
                var time = Date.now();
                var breakcall = settings.get('lastbrcall');

                // GM_setValue('ELTP_lastCap', Date.now());
                var caps = settings.get('caps');
                caps.push(time);
                settings.set('caps', caps);

                if ((breakcall > 0) && ((breakcall+20) < time)) { // break was called and we're in the 20 sec window
                    settings.set('capDiff', (tagpro.score.r-tagpro.score.b));
                    tagpro.group.socket.emit("chat", "Cap at " + pretty_remaining((fullTime-time)/1000) + ' counts');
                    tagpro.group.socket.emit("chat", "STOP now");
                    return_to_group();
                }
            }
        });

        /*
        tagpro.socket.on('score', function(data) {
            GM_setValue('ELTP_lastCap', Date.now());
            var fullTime = Date.parse(tagpro.gameEndsAt); // expected end of game
            var time = Date.now();
            var breakcall = GM_getValue('ELTP_lastbrcall');
            if (breakcall+20 < time) {
                GM_setValue('ELTP_capDiff', (tagpro.score.r-tagpro.score.b));
            }
        });
        */

        // upon end of a game
        tagpro.socket.on('end', function(data) {
            var fullTime = Date.parse(tagpro.gameEndsAt); // expected end of game
            var time = Date.now();
            var half = settings.get('half');
            console.log('half: ' + half);
            if (fullTime == time) {
                if (half+1 == 5) {
                    tagpro.group.socket.emit("chat", "Thanks for playing. Good game!");
                    deactivate();  // deactivate when half 4 was played
                } else {
                    next_half();
                }
            }
        });
    });
}

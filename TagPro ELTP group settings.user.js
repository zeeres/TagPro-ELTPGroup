// ==UserScript==
// @name         TagPro ELTP group settings
// @version      0.1
// @description  Sets default ELTP group settings, maps and also remaining time in case of break request
// @author       zeeres
// @include      http://tagpro-*.koalabeast.com*
// @grant        GM_setValue
// @grant        GM_getValue
// ==/UserScript==

var timeNow = Date.now();
var maps = ["EMERALD", "Pilot", "Market", "Transilio", "Atomic", "IRON", "Rush", "", ""];
var eltp_start = 1477094400*1000;  // Week 0: ENLTP
var time = (timeNow-eltp_start)/(7*24*60*60*1000);
var week = Math.floor(time);  // This week we are in now


var WhereAmI = function(){
    if (window.location.port) {
        return('game');
    } else if (window.location.pathname.startsWith('/group')) {
        return('group');
    } else {
        return('elsewhere');
    }
};

var IAmIn = WhereAmI();

function setup() {
    // Sets up the button and calls activate and deactivate functions if checkbox is changed

    var $pull_right = $('.group-settings');  // Element where the "ELTP Group" is placed
    //var text_checked = '';
    //if (GM_getValue('ELTP_activated')) $text_checked = ' checked = "checked"';

    // $pull_right.append('<label class="btn btn-primary group-setting" id="eltplabel"><input type="checkbox" class="js-socket-public" name="ELTPGame"' + text_checked + '>ELTP Group</label');
    $pull_right.append('<label class="btn btn-primary group-setting" id="eltplabel"><input type="checkbox" class="js-socket-public" name="ELTPGame">ELTP Group</label');
    $('input[name="ELTPGame"]').change(function() {  // when the "ELTP group" button is pushed
        GM_setValue('ELTP_activated', this.checked);
        if (this.checked) {  // if button is activated, activate default settings for the week
            save_settings();
            activate();
        } else {
            deactivate();
            restore_prev_settings();
        }
    });
}

// Save the settings for later
function save_settings() {
    GM_setValue('ELTP_map', $('select[name="map"] option:selected').attr('value'));
    GM_setValue('ELTP_time', $('select[name="time"] option:selected').attr('value'));
    GM_setValue('ELTP_caps', $('select[name="caps"] option:selected').attr('value'));

    var settings = [];
    $('.form-control.js-customize option').each(function(i, obj) { // get all the available settings in the select-box
        settings.push($(obj).attr('value'));
    });
    GM_setValue('ELTP_settings', settings);  // store them

    for(var i = 0; i < settings.length; i++) {  // get the value for each of the settings and store it
        if (settings[i] === '') continue;
        var val = '';
        val = $('select[name="' + settings[i] + '"] option:selected').attr('value');
        if (val === undefined) {  // no selectbox, but a checkbox
            val = $('input[name="' + settings[i] + '"]')[0].checked;
        }
        GM_setValue('ELTP' + settings[i], val);
    }

    $('.non-default.col-md-12').each(function(i, obj) {
        GM_setValue('ELTP_'+$(obj).attr('name'), true);
    });
}

// Deactivate
function deactivate() {
    console.log('TagPro ELTP Settings deactivated');
}

// Restore the settings from before the button was activated
function restore_prev_settings() {
    tagpro.group.socket.emit("setting", {"name": "map", "value": GM_getValue('ELTP_map')});
    tagpro.group.socket.emit("setting", {"name": "time", "value": GM_getValue('ELTP_time')});
    tagpro.group.socket.emit("setting", {"name": "caps", "value": GM_getValue('ELTP_caps')});

    var settings = GM_getValue('ELTP_settings');
    for(var i = 0; i < settings.length; i++) {
        tagpro.group.socket.emit("setting", {"name": settings[i], "value": GM_getValue('ELTP_' + settings[i])});
    }
}

// Set the default settings
function default_settings() {
    // console.log('default_settings');
    // $('select[name="time"]').val(10);
    // $('select[name="caps"]').val(0);
    // console.log('week: '+week);
    tagpro.group.socket.emit("setting", {"name": "map", "value": maps[(GM_getValue('ELTP_half') > 2)?(week+1):week]});  // if in second game, use the next map
    tagpro.group.socket.emit("setting", {"name": "time", "value": 10});
    tagpro.group.socket.emit("setting", {"name": "caps", "value": 0});
    tagpro.group.socket.emit("setting", {"name": "buffDelay", "value": true});
}

// Activate
function activate() {
    console.log('TagPro ELTP Settings activated');
    default_settings();
}

function listeners() {
    tagpro.group.socket.on('you', function(data) {
        GM_setValue('ELTP_me', data);
        //console.log('me'+data);
    });

    tagpro.group.socket.on('member', function(member) {
        if (member.id == GM_getValue('ELTP_me')) {
            if (member.leader) {
                GM_setValue('ELTP_itsMe', true);
                // activated = true;
                // if (!activated) {
                //    activate();
                // }
            } else {  // if we aren't the leader (anymore), deactivate
                GM_setValue('ELTP_itsMe', false);
                if (GM_getValue('ELTP_activated')) {
                    activated = false;
                    deactivate();
                }
            }
        }
    });

    // console.log(tagpro.group.socket);
    tagpro.group.socket.on('setting',function(priv) {
            GM_setValue('ELTP_'+priv.name, priv.value);
    });

    // save last cap time to determine if the cap was in the 20 seconds after br was called
    tagpro.group.socket.on('sound', function(data) {
        if (data.s === 'cheering' || data.s === 'sigh') GM_setValue('ELTP_lastCap', Date.now());
    });

    // upon end of a game
    tagpro.group.socket.on('end', function(data) {
        var fullTime = Date.parse(tagpro.gameEndsAt); // expected end of game
        var time = Date.now();
        var half = GM_getValue('ELTP_half');
        if (fullTime == time) {
            if (half+1 == 5) {
                tagpro.group.socket.emit("chat", "Thanks for playing. Good game!");
                deactivate();  // deactivate when half 4 was played
            } else {
                GM_setValue('ELTP_half', half+1);
                // reset br calls for both teams
                GM_setValue('ELTP_lastbrcall', 0);
                GM_setValue('ELTP_brcall_team1', 0);
                GM_setValue('ELTP_brcall_team2', 0);
                default_settings();  // sets new map (if half > 2)
            }
        }
    });
}

// round to specified decimal places
function round_places(number, places) {
  return +(Math.round(number + "e+" + places)  + "e-" + places);
}

// print pretty remaining time
function pretty_remaining(time) {
    return ((time-20) > 0)?(Math.floor((time-20) / 60) + ':' + Math.round(((time-20) % 60))):'0:00';
}

// when br is called
function chat_br(chat) {
    // console.log('chat');
    var breakcallat = 0;
    // console.log(chat);
    var team = 0;
    var message = '';
    for (var playerId in tagpro.players) {
        if (playerId == chat.id) {
            team = tagpro.players[tagpro.playerId].team;
        }
    }

    GM_setValue('ELTP_brcall_team' + team, 1);

    if (GM_getValue('ELTP_brcall_team' + team) > 0) {  // team already used br in this half
        message = 'Sorry, but you used your BR for this half already. Keep playing!';
        tagpro.group.socket.emit("chat", message);
    } else {
        var fullTime = Date.parse(tagpro.gameEndsAt); // expected end of game
        var time = Date.now(); // time of br call
        breakcallat = (fullTime-time)/1000;
        var text_breakcallat = pretty_remaining(breakcallat);
        var text_breakcallatm20 = pretty_remaining(breakcallat-20);
        if ((breakcallat-20) < GM_getValue('ELTP_lastbrcall')) {
            // GM_setValue('ELTP_lastbrcall', breakcallat);
            message = 'BR was already called, STOP at' + pretty_remaining(GM_getValue('ELTP_lastbrcall')-20) + ' or next cap';
        } else {
            message = 'BR was called, STOP at' + text_breakcallatm20 + ' or next cap';
        }
        tagpro.group.socket.emit("chat", message);  // send br message to group chat
    }
    return breakcallat;
}

if(IAmIn === 'group') { // group page
    var init = false;
    var activated = true;

    tagpro.group.socket.on('private',function(priv) {
        if(GM_getValue('ELTP_groupId')!==location.pathname) {
            GM_setValue('ELTP_groupId',location.pathname);
        }

        if(priv.isPrivate) {
            if (!init) {
                setup();
                init = true;
            }
            if (GM_getValue('ELTP_activated')) {  // if script was activated and page was either refreshed or
                // console.log('is_activated');
                default_settings();
                $('input[name="ELTPGame"]').prop('checked', true);

                if (GM_getValue('ELTP_lastbrcall') > 0) {  // if break was called in game
                    var teams = ['redTeamName', 'blueTeamName'];
                    if (GM_getValue
                    var message = GM_getValue('ELTP_' + ('BR was called at';
                    tagpro.group.socket.emit("chat", message);
                }
                
                listeners();
            } else {
                GM_setValue('ELTP_half', 1);
            }
        }
    });
} else if (IAmIn === 'game') {
    tagpro.ready(function() {
        // console.log('test');
        tagpro.socket.on('chat', function(chat){
            if (chat.message.trim().toLowerCase() === "br") {  // br was called
                chat_br(chat);
                // TODO: after 20s, return to group page
            }
        });
    });
}

// ==UserScript==
// @name         TagPro ELTP group
// @version      0.5
// @description  Sets default ELTP group settings, maps and also remaining time in case of break request
// @author       zeeres
// @include      http://tagpro-*.koalabeast.com*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_deleteValue
// @grant        GM_addStyle
// @updateURL    https://github.com/zeeres/TagPro-ELTPGroup/raw/master/TagPro-ELTPGroup.user.js
// @downloadURL  https://github.com/zeeres/TagPro-ELTPGroup/raw/master/TagPro-ELTPGroup.user.js
// ==/UserScript==

var timeNow = Date.now();
// var maps = ["EMERALD", "Pilot", "Market", "Transilio", "Atomic", "IRON", "Rush", "Curb", "Pilot"];
var maps = {0: ["Wombo_Combo", "Plasma"], 1: ["Cloud", "Wamble"], 2: ["Ricochet", "Gumbo"], 3: ["Bulldog", "CommandCenter", "Volt"]};  // format - {week: ["map1", "map2"]}, where week is the amount of weeks after eltp_start
//var eltp_start = 1477094400*1000;  // Week 0: ENLTP
var eltp_start = 1486512000*1000;  // Wednesday, Feb 08; Week 0 of ECLTP
var time = (timeNow-eltp_start)/(7*24*60*60*1000);
var week = 0;
function set_week() {
    week = Math.floor(time);  // We are in this week now
}
set_week();

var debug = false;

function logd(message) {
    if (debug) console.log(message);
}

var default_data = {stored: true, active: true, map: '', time: 10, game_caps: [], offset: [0, 0], score: [0, 0], capDiff: 0, half: 1, lastbrcall: 0, lastbrcall_team: 0, brcall_team1: false, brcall_team2: false, me: '', leader: false};  // default data

class Settings {
    constructor(data) {
        this.prefix = 'TPEGS_';
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
        logd('have set ' + variable + ' to ' + value);
        logd('check ' + this.prefix + variable + ' was set to ' + GM_getValue(this.prefix+variable));
    }
    delete(variable) {
        delete this.data[variable];
        GM_deleteValue(this.prefix+variable);
    }
    get(variable, share_prefix) {
        share_prefix = share_prefix || false;
        var value = (share_prefix)?(JSON.parse(window.localStorage.getItem(share_prefix+variable))):GM_getValue(this.prefix+variable);
        logd((share_prefix)?(variable + ' (from localStorage) is:'):(variable + ' is:'));
        logd(value);
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
    share(variable) {
        window.localStorage.setItem(this.prefix+variable, JSON.stringify(this.data[variable]));
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

function team_swap() {
    var offset = settings.get('offset'),
        brcallteam1 = settings.get('brcall_team1'),
        brcallteam2 = settings.get('brcall_team2');

    settings.set('offset', [offset[1], offset[0]]);
    $('input[name="tpeltp_offset_0"]').prop('value', offset[1]);
    $('input[name="tpeltp_offset_1"]').prop('value', offset[0]);
    settings.set('brcall_team1', brcallteam2);
    $('input[name="tpeltp_redbr"]').prop('checked', brcallteam2);
    settings.set('brcall_team2', brcallteam1);
    $('input[name="tpeltp_bluebr"]').prop('checked', brcallteam1);
}

function add_halves() {
    $('#tpeltp_halves').append('Half <label class="btn btn-default"><input type="radio" name="tpeltp_half" value="1">1</label>');
    $('#tpeltp_halves').append('<label class="btn btn-default"><input type="radio" name="tpeltp_half" value="2">2</label>');
    for (var i = 1; i < maps[week].length; i++) {
        $('#tpeltp_halves').append('<label class="btn btn-default"><input type="radio" name="tpeltp_half" value="' + (i*2 + 1) + '">' + (i*2 + 1) + '</label>');
        $('#tpeltp_halves').append('<label class="btn btn-default"><input type="radio" name="tpeltp_half" value="' + (i*2 + 2) + '">' + (i*2 + 2) + '</label>');
        $('#tpeltp_div input[name="tpeltp_half"][value="' + settings.get('half') + '"]').prop("checked", true);
        $('input[name="tpeltp_half"]').change(function() {  // when one of the "half" buttons is pushed
            settings.set('half', $(this).prop('value'));
            set_map();
        });
    }
}

function setup() {
    logd('setup');
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
    $('#tpeltp_div').append('Week ');
    logd(week);
    maps_keys = Object.keys(maps).sort();
    for (var w in maps_keys) {
        $('#tpeltp_div').append('<label class="btn btn-default"><input type="radio" name="tpeltp_week" value="'+w+'">'+w+'</label>');
    }
    if (week <= Math.max(...Object.keys(maps))) $('#tpeltp_div input[name="tpeltp_week"][value="' + week + '"]').prop("checked", true);
    $('input[name="tpeltp_week"]').change(function() {  // when one of the "week" buttons is pushed
        week = $(this).prop('value');
        set_map();
        $('#tpeltp_halves').html('');
        add_halves();
    });

    $('#tpeltp_div').append('<br>');

    // half buttons
    $('#tpeltp_div').append('<div id="tpeltp_halves"></div>');
    add_halves();
    var offset = settings.get('offset'),
        score = settings.get('score');
    logd('score:');
    logd(score);
    if (score !== undefined) offset[0] += score[0]; offset[1] += score[1];
    score = [0, 0];
    settings.set('score', score);
    settings.set('offset', offset);
    logd('offset:');
    logd(offset);
    $('#tpeltp_div').append('<div id="tpeltp_offset_div" style="width: 100%">Offsets </div><table id="tpeltp_offset"><tr><td><input type="text" name="tpeltp_offset_0" class="form-control" style="width:40px" value="' + offset[0] + '"></td><td><input type="text" name="tpeltp_offset_1" class="form-control" style="width:40px" value="' + offset[1] + '"></td></tr></table>');
    function change_offset(elem, dvalue) {
        var offset = settings.get('offset'),
            value = parseInt(elem.prop('value')),
            newvalue = value+dvalue,
            match = elem.prop('name').match(/tpeltp_offset_([0-9]+)/),
            lr = match[1];
        if (newvalue >= 0) {
            elem.prop('value', newvalue);
            offset[parseInt(lr)] = newvalue;
            settings.set('offset', offset);
        }
    }

    $('#tpeltp_offset input').keydown(function (e) {
        var keyCode = e.keyCode || e.which,
            arrow = {left: 37, up: 38, right: 39, down: 40 };
        if (keyCode == arrow.up) change_offset($(this), +1);
        else if (keyCode == arrow.down) change_offset($(this), -1);
    });
    $('#tpeltp_offset input').bind('mousewheel DOMMouseScroll', function (event) {
        event.preventDefault();  // disables scrolling temporarily
        if (event.originalEvent.wheelDelta > 0 || event.originalEvent.detail < 0) change_offset($(this), +1);
        else change_offset($(this), -1);
    });

    $('#tpeltp_div').append('<br><div id="tpeltp_red" align="center" class="col-md-6 private-game"></div><div id="tpeltp_blue" align="center" class="col-md-6 private-game"></div>');
    // team br call buttons
    $('#tpeltp_red').append('<label class="btn btn-default"><input type="checkbox" class="js-socket-public" name="tpeltp_redbr"> used br</label>');
    $('input[name="tpeltp_redbr"]').prop('checked', settings.get('brcall_team1'));
    $('input[name="tpeltp_redbr"]').change(function() {  // when one of the "half" buttons is pushed
        settings.set('brcall_team1', $(this).prop('checked'));
    });
    $('#tpeltp_blue').append('<label class="btn btn-default"><input type="checkbox" class="js-socket-public" name="tpeltp_bluebr"> used br</label>');
    $('input[name="tpeltp_bluebr"]').prop('checked', settings.get('brcall_team2'));
    $('input[name="tpeltp_bluebr"]').change(function() {  // when one of the "half" buttons is pushed
        settings.set('brcall_team2', $(this).prop('checked'));
    });

    $('#swapTeams-btn').click(function() {
        team_swap();
    });

    if (settings.get('active')) {  // if script was activated and page was either refreshed or we returned from game
        logd('setup is_activated');
        // activate();
        $('input[name="ELTPGame"]').prop('checked', true);
        var brcalltime = settings.get('lastbrcall');
        logd('setup brcalltime:' + brcalltime);
        if (brcalltime > 0) {  // if break was called
            $('#end-game-btn').click();
            logd('brcalled');
            var teams = ['redTeamName', 'blueTeamName'];
            var team_called = settings.get('lastbrcall_team');
            if (team_called === 1) {
                $('#tpeltp_redbr').prop('checked', true);
            } else if (team_called === 2) {
                $('#tpeltp_bluebr').prop('checked', true);
            }
            logd('team_called: ' + team_called);
            var capDiff = settings.get('capDiff');
            logd('capDiff: ' + capDiff);
            var round_up = 0;
            if (team_called == 1 && capDiff > 0 || team_called == 2 && capDiff < 0 || capDiff === 0 && brcalltime % 60 >= 30) {  // rounding up if the winning team calls the br or scores are even and clock > :30
                round_up = 1;
            }
            var newgameminutes = (round_up === 0)?(Math.floor(brcalltime / 60)):(Math.ceil(brcalltime / 60));
            var winningteam = 0;
            if (capDiff > 0) {
                winningteam = 1;
            } else if (capDiff < 0) {
                winningteam = 2;
            }
            logd('winningteam: ' + winningteam);
            var message = settings.get(teams[team_called-1]) + ' called BR at ' + pretty_remaining(settings.get('lastbrcall')) + ', ';
            logd(message);
            message += (winningteam > 0)?(settings.get(teams[winningteam-1]) + ' was winning'):('caps were even');
            logd(message);
            message += ', so I\'ll round ';
            logd(message);
            message += (round_up > 0)?('up'):('down');
            logd(message);
            message += ' to ' + newgameminutes + ' Minutes';
            logd(message);
            setTimeout(function() {
                tagpro.group.socket.emit("chat", message);
            }, 5000);  // wait 5s to send the message
            settings.set('lastbrcall', 0);  // reset last br call
            settings.set('lastbrcall_team', 0);
            $('#tpeltp_div').append('<br><button class="btn btn-primary" style="font-size: 16px;" id="tpeltp_brmsg" value="' + message + '">Send BR message (again)</button>');
            $('#tpeltp_brmsg').click(function() {
                tagpro.group.socket.emit("chat", $(this).prop('value'));
            });
            if ((newgameminutes === 0)) {
                next_half();  // proceed to next half if there's no minutes left
            } else {
                tagpro.group.socket.emit("setting", {"name": "time", "value": newgameminutes});
            }
        }
        // default_settings();
        listeners();  // start the listeners
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
    $("#tpeltp_div").hide();
    $("#tpeltp_header").css('background', '#919c28');
    settings.set('active', false);
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
    var half = settings.get('half');
    logd('set_map maps[' + week + ']:');
    logd(maps[week]);
    logd('(' + half + ' % 2 === 1)?' + (half-1)/2 + ':' + (half-2)/2);
    // var map = maps[(settings.get('half') > 2)?(parseInt(week)+1):week];
    var map = maps[week][(half % 2 === 1)?(half-1)/2:(half-2)/2];
    logd('maps[' + week + '][' + ((half % 2 === 1)?(half-1)/2:(half-2)/2) + '] = ' + map);
    tagpro.group.socket.emit("setting", {"name": "map", "value": map});  // if in second game, use the next map
}

// Set the default settings
function default_settings() {
    // logd('default_settings');
    // $('select[name="time"]').val(10);
    // $('select[name="caps"]').val(0);
    // logd('week: '+week);
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
    settings.set('active', true);
}

// reset br calls variables
function reset_brcalls() {
    // reset br calls for both teams
    settings.set('lastbrcall', 0);
    settings.set('lastbrcall_team', 0);
    settings.set('brcall_team1', false);
    settings.set('brcall_team2', false);
    settings.set('game_caps', []);
    settings.set('capDiff', 0);
}

// next Half
function next_half() {
    var half = parseInt(settings.get('half'));
    settings.set('half', half+1);
    if (half >= 2 && half % 2 === 0) reset_brcalls();
    default_settings();  // sets new map (if half > 2)
}

function listeners() {
    tagpro.group.socket.on('you', function(data) {
        settings.set('me', data);
        //logd('me'+data);
    });

    tagpro.group.socket.on('member', function(member) {
        if (member.id == settings.get('me')) {
            if (member.leader) {
                settings.set('leader', true);
                if (!settings.get('active')) activate();
            } else {  // if we aren't the leader (anymore), deactivate
                logd('not leader, deactivate');
                settings.set('leader', false);
                if (settings.get('active')) deactivate();
            }
        }
    });

    // logd(tagpro.group.socket);
    tagpro.group.socket.on('setting',function(data) {
        logd('changed setting:');
        logd(data);
        settings.set(data.name, data.value);
    });

    // save last cap time to determine if the cap was in the 20 seconds after br was called
}

// round to specified decimal places
function round_places(number, places) {
  return +(Math.round(number + "e+" + places)  + "e-" + places);
}

// print pretty remaining time
function pretty_remaining(time, full=false) {  // time in seconds // full = full minutes (round)
    logd('pretty_remaining(' + time + ')');
    var minutes = (time%60<10)?'0'+Math.floor(time%60):Math.floor(time % 60);
    if (!full) {
        time = Math.round(time*10)/10;  // round to first millisecond digit
        minutes = (time%60<10)?'0'+Math.floor(time%60):Math.round(time % 60);
        return (time > 0)?(Math.floor(time / 60) + ':' + minutes + '.' + Math.round((time*1000)%1000)/100):'0:00.0';
    } else {
        return (time > 0)?(Math.floor(time / 60) + ':' + minutes):'0:00';  // without milliseconds
    }
    logd('minutes: ' + minutes);
}

function return_to_group() {
    var group_path = settings.get('group-path');
    if (group_path !== undefined) window.location.href = window.location.protocol + '//' + window.location.hostname + group_path;
}

// when br is called
function chat_br(chat) {
    var breakcallat = 0;
    var team = 0;
    var message = '';
    logd('br chat.from: ' + chat.from);
    for (var playerId in tagpro.players) {
         logd('playerId: ' + playerId + ', playerTeam: ' + tagpro.players[playerId].team);
        if (playerId == chat.from) {
            team = tagpro.players[playerId].team;
        }
    }
    logd('team: ' + team);
    logd('brcall_team'+team+': ' + settings.get('brcall_team' + team));
    if (settings.get('brcall_team' + team) > 0) {  // team already used br in this half
        message = 'Sorry, but you used your BR for this game already. Keep playing!';
        tagpro.group.socket.emit("chat", message);
    } else {
        settings.set('brcall_team' + team, 1);  // save team that called br
        var fullTime = Date.parse(tagpro.gameEndsAt); // expected end of game
        logd('fullTime: ' + fullTime);
        var time = Date.now();  // time of br call
        logd('time: ' + time);
        breakcallat = (fullTime-time)/1000;
        logd('breakcallat: ' + breakcallat);
        logd('lastbrcall: ' + settings.get('lastbrcall'));
        var lastbrcall = settings.get('lastbrcall');
        var saved_breakcallat = (fullTime-lastbrcall)/1000;
        var text_breakcallat = pretty_remaining(breakcallat);
        var text_breakcallatm20 = pretty_remaining(breakcallat-20, true);
        logd('breakcallat-20: ' + round_places(breakcallat-20, 3));
        logd('saved_breakcallat: ' + round_places(saved_breakcallat, 3));
        if ((lastbrcall > 0) && ((breakcallat-20) < ((fullTime-settings.get('lastbrcall'))/1000))) {
            message = 'BR was already called, STOP at ' + pretty_remaining(saved_breakcallat-20, true) + ' or next cap';
        } else if (breakcallat < 60) {
            message = 'BR is invalid, we are in the last minute of this half';
        } else {
            settings.set('lastbrcall', breakcallat);
            settings.set('lastbrcall_team', team);
            message = 'BR was called, STOP at ' + text_breakcallatm20 + ' or next cap';
            setTimeout(function() {
                tagpro.group.socket.emit("chat", 'STOP');
                return_to_group();
            }, 20000);
        }
        tagpro.group.socket.emit("chat", message);  // send br message to group chat
    }
}


if(IAmIn === 'group') { // group page
    var init = false;
    var activated = true;
    logd('group lastbrcall: ' + settings.get('lastbrcall'));
    tagpro.group.socket.on('private',function(priv) {
        if(priv.isPrivate && !init) {
            setup();
            settings.set('group-path', window.location.pathname);
            if (settings.get('switch_teams')) $('#swapTeams-btn').click();
            init = true;
        }
    });
} else if (IAmIn === 'game') {
    tagpro.ready(function() {
        var active = settings.get('active');
        logd('active: ');
        logd(active);
        if (!active) return;
        // logd('test');
        tagpro.socket.on('chat', function(chat) {
            if (chat.message.trim().toLowerCase() === "br") {  // br was called
                chat_br(chat);
            }
        });

        tagpro.socket.on('sound', function(data) {  // there was a cap
            if (data.s === 'cheering' || data.s === 'sigh') {
                logd('cap');
                var fullTime = Date.parse(tagpro.gameEndsAt); // expected end of game
                var captime = fullTime-Date.now();
                var breakcall = parseInt(settings.get('lastbrcall'));
                // GM_setValue('ELTP_lastCap', Date.now());
                var game_caps = settings.get('game_caps');
                var offset = settings.get('offset');
                game_caps.push(time);
                settings.set('game_caps', game_caps);
                if ((breakcall > 0)) { // break was called and we're in the 20 sec window
                    if ((breakcall-20) < captime/1000) {
                        tagpro.group.socket.emit("chat", "Cap at " + pretty_remaining(captime/1000) + ' counts');
                        tagpro.group.socket.emit("chat", "STOP");
                    } else {
                        tagpro.group.socket.emit("chat", "Cap at " + pretty_remaining(captime/1000) + ' doesn\'t count');
                    }
                    return_to_group();
                }
                logd('onsound lastbrcall: ' + settings.get('lastbrcall'));
            }
        });

        tagpro.socket.on('score', function(data) {
            var score = settings.get('score'),
                offset = settings.get('offset'),
                fullTime = Date.parse(tagpro.gameEndsAt), // expected end of game
                captime = fullTime-Date.now(),
                breakcall = parseInt(settings.get('lastbrcall'));
            if (breakcall > 0 && (breakcall-20) < captime/1000) { // break was called and we're in the 20 sec window or no break was called
                settings.set('score', [data.r, data.b]);
            } else if (breakcall === 0) {
                settings.set('score', [data.r, data.b]);
                settings.set('capDiff', (offset[0]+data.r-(offset[1]+data.b)));
            }
        });

        // upon end of a game
        tagpro.socket.on('end', function(data) {
            var fullTime = Date.parse(tagpro.gameEndsAt); // expected end of game
            var time = Date.now();
            var half = settings.get('half');
            var offset = settings.get('offset');
            logd('half: ' + half);
            logd('fullTime: ' + fullTime);
            logd('time: ' + time);
            if (Math.floor(fullTime/1000) == Math.floor(time/1000)) {
                // if (half+1 == 5) {
                //     tagpro.group.socket.emit("chat", "Thanks for playing. Good games!");
                //     deactivate();  // deactivate when half 4 was played
                // } else {
                //     next_half();
                // }
                if (half % 2 === 1) settings.set('switch_teams', true);
                next_half();
            }
            //offset = [parseInt(offset[0]+parseInt(tagpro.score.r)), parseInt(offset[1] + parseInt(tagpro.score.b))];
            //settings.set('offset', offset);
        });
    });
}

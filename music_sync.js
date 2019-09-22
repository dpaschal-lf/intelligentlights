var start_time = null;
var script = [];
var script_bookmark = 0;
var next_script_trigger_time = 999999;
var player;
var recording= false;
$(document).ready(initialize_music_sync);

function initialize_music_sync(){
	player = document.getElementById('main-player');
	$("#main-player").on('timeupdate',check_current_time);
	$("#save-script").click(save_script);
	$("#main-player").on('seeked',function(){
		console.log('seek stopped, getting time');
		script_bookmark = find_next_trigger_time()-1;
		sync_lights_to_position(script_bookmark);
		get_next_trigger_time();
	});
	$("#record-button").click(toggle_recording);
	load_script();
	initiate_trigger_time();
}
function delete_script_range(light_id, time_start, time_end, filter){
	if(filter == undefined){
		filter = '.*';
	}
	if(time_end== undefined){
		time_end = player.duration;
	}
	if(time_start == undefined){
		time_start = 0;
	}
	if(light_id == undefined){
		console.log('must specify a light');
		return;
	}
	var decision = prompt(JSON.stringify(filter)+' information for light '+light_id+': '+light_list[light_id].name+' will be deleted between '+time_start+ ' and '+ time_end+'.  Are you sure? (Y/N)');
	if(decision != 'Y'){
		return;
	}
	var start_index = 0;
	var end_index = script.length-1;

	//TODO: make use of filter
	for(var i=0; i<script.length; i++){
		if(script[i].trigger_time > time_start ){

			if(script[i].trigger_time > time_end){
				break;
			}
			if(script[i].light_id == light_id){
				script.splice(i,1);
			}
		}
	}
	
}
function record_light_activity(id,action,override){
	if(!recording && player.paused && (override != true)){
		return;
	}
	console.log('recording action at position '+script_bookmark);
	var tracker_object = {
		light_id : id,
		action : action,
		trigger_time : player.currentTime
	};
	script.splice(script_bookmark,0,tracker_object);
	script_bookmark++;
}
function toggle_recording(){
	recording = !recording;
	if(recording){
		$("#record-button").addClass('btn-danger').text('RECORDING');
	} else{
		$("#record-button").removeClass('btn-danger').text('not recording');
	}
}
function clear_script(){
	var check = prompt("This will delete the script, are you sure (Y/N)");
	if(check == 'Y'){
		script = [];
		save_script();
	}
}
function save_script(){
	var string_script = JSON.stringify(script);
	localStorage.music_script = string_script;
}
function load_script(){
	if(localStorage.music_script!==undefined){
		script = JSON.parse(localStorage.music_script);
	}
}
function save_initial_state(){
	var state = {
		on: null,
		bri: null,
		hue: null,
		sat: null
	}
	for(var i in light_list){
		for(var j in state){
			state[j] = light_list[i].state[j];
		}
		record_light_activity(i,state,true);
	}
}
function initiate_trigger_time(){
	if(script.length>0){
		script_bookmark = 0;
		next_script_trigger_time = script[0].trigger_time;
	}
	else{
		next_script_trigger_time=999999;
	}
}
function find_next_trigger_time(){
	var current_time = player.currentTime;
	if(script.length>0){
		for(var i in script){
			if(script[i].trigger_time > current_time){
				return i;
			}
		}
		return script.length;
	}
	else{
		return 0;
	}
}
function sync_lights_to_position(position){
	var lights = [];

	for(var i in light_list){
		lights[i]={};
	}
	for(var i=1; i<position; i++){
		for(var j in script[i].action){
			lights[script[i].light_id][j] = script[i].action[j];
		}
	// var tracker_object = {
	// 	light_id : id,
	// 	action : action,
	// 	trigger_time : player.currentTime
	// };		
	}
	for(var i in light_list){
		if(get_object_length(lights[i])>0){
			alter_light(i,lights[i]);
		}
	}
}
function get_next_trigger_time(){
	if(script.length>0){
		script_bookmark++;
		console.log('bookmark: '+script_bookmark);
		if(script_bookmark==script.length){
			next_script_trigger_time = 999999;
		}
		else{
			next_script_trigger_time = script[script_bookmark].trigger_time;			
		}

		console.log('next time is '+next_script_trigger_time+ ' at '+(script_bookmark-1));
	}

}

function check_current_time(){
	if(player.paused){
		return;
	}
	//console.log('current: '+player.currentTime + ' next: '+next_script_trigger_time);
	while(script_bookmark < script.length && script[script_bookmark].trigger_time < player.currentTime){
		console.log('triggering',script[script_bookmark].action);
		alter_light(script[script_bookmark].light_id,script[script_bookmark].action);
		script_bookmark++;
	}
}


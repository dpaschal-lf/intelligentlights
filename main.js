$(document).ready(initialize);
var bridge_address;
var username='r3hXZlnz793nmDOj0zwyqXGWmqUq3FPQqlprsFC7';
var light_list={};
var interval_timer_ids=[];
var freak_out_interval;
function initialize(){
	$("#connect-button").click(connect_to_bridge);
	$("#bridge_ip").on('keypress',update_ip);
	update_ip.call($("#bridge_ip"));//initialize this since I've put the value into the input directly
	attempt_retrieve_username();
	$("#get-light-list-button").click(get_light_list);
	get_saved_light_list();
}
function get_saved_light_list(){
	var local_light_list;
	if(localStorage.light_list != undefined){
		try{
			local_light_list = JSON.parse(localStorage.light_list);
		} catch(err){
			console.log('error parsing json for light list');
		}
		console.log('local_light_list is ',local_light_list);
		light_list = local_light_list;
		update_info_for_all_lights(light_list);
	}
}
function attempt_retrieve_username(){
	if(localStorage.username != undefined){
		username = localStorage.username
	}	
}
function update_info_for_all_lights(light_list){
	var light_count = get_object_length(light_list);
	for(var i in light_list){
		get_light_info(i, function(light_id){
			if(--light_count==0){
				process_lights(light_list);
			} 
		});
	}	
}
function get_active_user(){
	if(username==null){
		show_feedback('No user initialized!','error');
		return false;
	}
	return username;

}
function get_light_list(){
	var user=get_active_user();
	if(!user){
		return;
	}
	var params = {
		url: bridge_ip + '/'+user+'/lights',
		method: 'GET',
		success_callback: function(response){
			//console.log('success: ',response);
			process_lights(response);
		},
		error_callback: function(response){
			//console.log('error: ',response);
		}
	};
	ajax_call(params);
}
function process_lights(lights_object){
	var light_dom;
	for(var i in lights_object){
		if(lights_object[i].info == undefined){
			lights_object[i].info = {id:i};
		}
		light_list[i] = lights_object[i];
		light_list[i].info.dom_element = display_light(lights_object[i]);
		$("#light-list").append(light_list[i].info.dom_element);
		display_light_hue_bri_sat(light_list[i]);

	}
	$(".drop-partner").sortable({ 
		connectWith: ".drop-partner",
		container: 'body',
		//helper: 'clone'
	});
	$("#light-placement").droppable({
		connectWith: '#light-list',
		stop: function(event,ui){
			console.log('drag start');
		},
		drop:function(event, ui){
			if(!ui.draggable.hasClass('minified')){
				console.log('updating light '+ui.draggable.attr('data-id'));
				console.log("dragged element: ",ui);
				ui.draggable.addClass('minified').css('width','auto');


				 //this is actually breaking it, but good enough for now
				//ui.draggable.resizable();
			}
			light_list[ui.draggable.attr('data-id')].info.position = ui.draggable.position();
			save_light_info();
			ui.draggable.sortable("disable");
			
		}
	});
	$(".minified").draggable({
		container: 'body'
	});
}
function save_light_info(){
	if(get_object_length(light_list)==0){
		console.log('empty light list, aborting');
		return;
	}
	var clean_object = copy_object(light_list);
	prune_object = temp_prune_objects_from_list(clean_object);
	var stringified_object = JSON.stringify(prune_object.og_list);
	localStorage.light_list = stringified_object;
	reattach_pruned_objects_to_list(prune_object.pruned_props);
}
function reattach_pruned_objects_to_list(light_list_parts){
	for(var i in light_list_parts){
		light_list_parts[i].original_object.info.dom_element = light_list_parts[i].dom_element; 
		light_list_parts[i].original_object.state = light_list_parts[i].state; 

	}
}
function temp_prune_objects_from_list(light_list){
	var object_preserver_list = [];
	for(var i in light_list){
		var object_preserver = {
			original_object : light_list[i],
			dom_element : light_list[i].info.dom_element,
			state : light_list[i].state
		}
		object_preserver_list.push(object_preserver);
		delete light_list[i].info.dom_element;
		delete light_list[i].state;
	}
	return {og_list: light_list, pruned_props: object_preserver_list}
}
function copy_object(object){
	var new_object = {};
	for(var i in object){
		if(object.hasOwnProperty(i)){
			new_object[i] = object[i];
		}
	}
	return new_object;
}
function get_object_length(object){
	var count = 0;
	for(var i in object){
		if(object.hasOwnProperty(i)){
			count++;
		}
	}	
	return count;
}
function get_light_info(light_id,callBack){
	var user=get_active_user();
	if(!user){
		return;
	}
	var params = {
		url: bridge_ip + '/'+user+'/lights/'+light_id,
		method: 'GET',
		success_callback: function(response){
			//console.log('get info success: ',response);
			if(typeof callBack == 'function'){
				if(light_list[light_id]==undefined){
					light_list[light_id] = {};
				}
				var temp;
				if(light_list[light_id].info!=undefined){
					temp = light_list[light_id].info;
				}
				light_list[light_id]= response;
				light_list[light_id].info=temp;
				callBack.call(this,light_id);
			}
		},
		error_callback: function(response){
			//console.log('error: ',response);

		}
	};
	ajax_call(params);	
}
function blink_light_on(light_id, time_interval){
	if(time_interval==undefined){
		time_interval = 2000;
	}
	if(interval_timer_ids[light_id]!=undefined){
		blink_light_off(light_id);
	}
	interval_timer_ids[light_id] = setInterval(function(){
		alter_light(light_id,{alert:'select'});

	},time_interval);
}
function blink_light_off(light_id){
	clearInterval(interval_timer_ids[light_id]);
	delete interval_timer_ids[light_id];
}
function is_color_bulb(light_id){
	if(light_list[light_id] == undefined || light_list[light_id].type == undefined){
		//console.log('don\'t have light info, getting light info and delaying');
		get_light_info(light_id,is_color_bulb);
		return false;
	}
	if(light_list[light_id].type.toLowerCase().indexOf('color')!=-1){
		return true;
	}
	else{
		return false;
	}
}
function color_rotate_toggle(light_id){
	if(!is_color_bulb(light_id)){
		show_feedback('Cannot color rotate this bulb','error');
		return false;
	}
	//console.log('looping color');
	if(light_states[light_id].info.effect =='colorloop'){
		alter_light(light_id,{'effect':'none'});
		light_list[light_id].info.effect = 'none';
	}
	else{
		light_list[light_id].info.effect = 'colorloop';
		alter_light(light_id,{'effect':'colorloop'});
	}
}
//TODO: check if the light can be reached before trying to alter it
function alter_light(light_id,properties, direct){
	console.log(light_id);
	var user=get_active_user();
	if(!user){
		return;
	}
			console.log('light '+light_id+' saving ',properties);
	if(direct != undefined){
		record_light_activity(light_id,properties);	
	}
	var params = {
		url: bridge_ip + '/'+user+'/lights/'+light_id+'/state',
		data: properties,
		method: 'PUT',
		success_callback: function(response){
			//console.log('success: ',response);
			if(response[0].success != undefined){
				
				for(var i in response[0].success){
					var response_array = i.split('/');
					light_list[response_array[2]][response_array[3]][response_array[4]] = response[0].success[i];
				}
				display_light_update(response_array,response[0].success[i]);
			}
			
		},
		error_callback: function(response){
			//console.log('error: ',response);
		}
	};
	ajax_call(params);

}
function display_light_update(light_data, new_state){
	if(light_data[3]=='state'){
		switch(light_data[4]){
			case 'on':
				var new_onoff = 'light-'+((new_state) ? 'on' : 'off');
				light_list[light_data[2]].info.dom_element.find('.light-on,.light-off').removeClass('light-on light-off').addClass(new_onoff);
			case 'hue':
			case 'bri':
				console.log('this is the new state');
				display_light_hue_bri_sat(light_list[light_data[2]]);
		}
	}
}
function calculate_cieXY_from_rgb(R,G,B){
	var X = 0.4124*R + 0.3576*G + 0.1805*B;
	var Y = 0.2126*R + 0.7152*G + 0.0722*B;
	var Z = 0.0193*R + 0.1192*G + 0.9505*B;
	var x = X / (X + Y + Z);
	var y = Y / (X + Y + Z);
	return {x: x, y: y};
}
function convertXYToRGB (x, y, brightness){
    var z = 1 - x - y;
    console.log('z: ', z);
    var Y = brightness;
    var X = (Y/y) * x;
    console.log('X: ', X);
    var Z = (Y/y) * z;
    console.log('Z: ', Z);
    var r =  X * 1.656492 - Y * 0.354851 - Z * 0.255038;
    var g = -X * 0.707196 + Y * 1.655397 + Z * 0.036152;
    var b =  X * 0.051713 - Y * 0.121364 + Z * 1.011530;
    console.log('r: ', r, 'g: ', g, 'b: ', b);
    r = r <= 0.0031308 ? 12.92 * r : (1.0 + 0.055) * Math.pow(r, (1.0 / 2.4)) - 0.055;
    g = g <= 0.0031308 ? 12.92 * g : (1.0 + 0.055) * Math.pow(g, (1.0 / 2.4)) - 0.055;
    b = b <= 0.0031308 ? 12.92 * b : (1.0 + 0.055) * Math.pow(b, (1.0 / 2.4)) - 0.055;
    r = Math.round(r);
    g = Math.round(g);
    b = Math.round(b);
    return [r, g, b];

}
function display_light(light){
	var state = light.state;
	/*
		<div class="light-div">
			<div class="icon light-on unreachable"><i class="fa fa-lightbulb-o" aria-hidden="true"></i></div>

	*/
	var light_div = $("<div>",{
		class: 'light-div',
		'data-id': light.info.id
	});
	if(light.info.position != undefined){
		light_div.css(light.info.position).addClass('minified');
	}
	var type = light.type.replace(/ /g,"-").toLowerCase();
	var icon_classes = type+ ' icon';
	if(!state.reachable){
		icon_classes += ' unreachable'
	}
	if(state.on){
		icon_classes += ' light-on'
	} else {
		icon_classes += ' light-off'
	}
	var light_icon = $("<div>",{
		class: icon_classes
	});
	light_icon.click(function(){
		alter_light(light.info.id,{
			on: !light.state.on
		},true);  //true to let the system know this was a direct click and not a recorded alter
	});

	var icon = $("<i>").addClass("fa fa-lightbulb-o").attr('aria-hidden','true');
	light_icon.append(icon);
	
/*
			<div class="light-info">
				<div>Name: <span>Hue white lamp 1</span></div>
				<div>type: <span>Dimmable Light</span></div>
				<div>reachable: <span>true</span></div>
			</div>
			<div class="light-controls">
			</div>
		</div>
		*/
	var light_info = $("<div>").addClass('light-info');
	var light_info_name = $("<div>").text('Name: ').append($("<span>").text(light.name));
	var light_info_type = $("<div>").text('type: ').append($("<span>").text(light.type));
	var light_info_brightness = $("<div>").text('bri: ').append($("<span>").text(light.state.bri));
	light_info.append(light_info_name, light_info_type, light_info_brightness);

	var light_controls = $("<div>").addClass('light-controls');
	if(is_color_bulb(light.info.id)){
		var color_control = $('<div>').addClass("color-bar");

		light_controls.append(color_control);
		color_control.click(function(){

            console.log('cc height: ', color_control.height());
            console.log('offsetX: ', event.offsetX);
            console.log('offsetY: ', event.offsetY);
			var x = 0.16 + calculate_ratio(color_control.width(),event.offsetX,0.51);
            console.log('x: ', x);
			var y = 0.04 + calculate_ratio(color_control.height() - 2,event.offsetY,0.48);
            console.log('yratio: ', calculate_ratio(color_control.height(),event.offsetY,0.48));
            console.log('y: ', y);

			alter_light(light.info.id,{
			xy: [x, y]
			},true);
			$('.color-bar').append($('<div>').css({}))
		});
	}
	var brightness_control = $('<div>').addClass('brightness-bar');
	brightness_control.click(function(){
		alter_light(light.info.id,{
			bri: calculate_ratio($(this).width(),event.offsetX,254)
		},true);
			
	});
	var off_on_container = $("<div>");
	var off_on_control = $("<input>").prop('id','offon_'+light.info.id).attr('type','checkbox').prop('checked',light.state.on);
	var off_on_label = $("<label>").text('ON/OFF').attr('for','offon_'+light.info.id);
	off_on_control.click(function(){
		alter_light(light.info.id,{
			on: !light.state.on
		},true);
	});
	off_on_container.append(off_on_control,off_on_label);
	light_controls.append(brightness_control,off_on_container);
	light_div.append(light_icon, light_info, light_controls);
	return light_div;

}
function calculate_ratio(element_dimension, property, max){
	var ratio = property / element_dimension;
	var new_value = max * ratio;	
	return new_value;
}
function update_ip(){
	bridge_ip = 'http://'+$(this).val()+'/api';
}
function show_feedback(message, status){
	$("#feedback").html(message).attr('class','').addClass(status);
}
function connect_to_bridge(){
	var url = bridge_ip;
	var data = {


		"devicetype":"r3hXZlnz793nmDOj0zwyqXGWmqUq3FPQqlprsFC7"
	};
	var method = 'POST';
	var success = function(response){
		if(response[0].error != undefined){
			//console.log('connection error: ',response)
			console.error(response[0].error.description);
			show_feedback(response[0].error.description,'error');
		}
		else{
			//console.log('connection success: ',response);
			username = response[0].success.username;
			localStorage.username = username;
			show_feedback('User connected and saved to localstorage');
		}
		
	}
	var error = function(response){
		//console.log('connection error: ',response)
	}
	ajax_call(url,data,method,success,error);
}

function ajax_call(url,data,method,success_callback,error_callback){
	//console.log('calling url '+url+' with data ',data);
	if(typeof url=='object'){
		data = url.data;
		if(url.method == undefined){
			method = 'POST'
		} else{
			method = url.method;
		}
		success_callback = url.success_callback;
		error_callback = url.error_callback;
		url = url.url;
	}
	if(success_callback == undefined){
		success_callback = function(response){
			//console.log('success',response);
		}
	}
	if(error_callback == undefined){
		error_callback = function(response){
			console.error('error: ');
			console.error(response);
		}
	}
	$.ajax({
		url: url,
		data: JSON.stringify(data),
		method: method,
		dataType: 'json',
		processData: false,
    	contentType: 'application/json',
		success: success_callback,
		error: error_callback
	});
}

function add_lights(light_id_array){
	var user=get_active_user();
	if(!user){
		return;
	}
	var params = {
		url: bridge_ip + '/'+user+'/lights',
		method: 'POST',
		data: {'deviceid':light_id_array},
		success_callback: function(response){
			console.log('success: ',response);
			process_lights(response);
		},
		error_callback: function(response){
			//console.log('error: ',response);
		}
	};
	ajax_call(params);
}
function freak_out_toggle(timing_in_ms){
	if(freak_out_interval==null){
		freak_out_interval=setInterval(freak_out,timing_in_ms);
	} else{
		clearInterval(freak_out_interval);
		freak_out_interval=null;
	}
}
function freak_out(){
	for(var i in light_list){
		var color = Math.floor(Math.random()*65535);
		alter_light(i,{hue:color});
	}
}
function all_lights_onoff(new_state){
	for(var i in light_list){
		alter_light(i,{on:new_state});
	}	
}
function all_lights_alter(new_state){
	for(var i in light_list){
		alter_light(i,new_state);
	}	
}
function light_speak(light_id, seconds){
	alter_light(light_id)
}
function convert_hue_to_rgb(hue, sat){
	if(hue==0){
		return {R: 255, G: 0, B: 0}
	}
	var transitions = [
		{ 
			start: 0,
			color: 'R'
		},
		{
			start: 25558, 
			color: 'G'
		},
		{
			start: 47185,
			color : 'B'
		},
		{
			start: 65535,
			color: 'R'
		}
	];
	prev = transitions[0];
	current = transitions[0];
	next = transitions[1];
	for(var i=0; i<transitions.length; i++){
		if(hue>transitions[i].start){
			prev = current;
			current = transitions[i];
			next = transitions[i+1];
		}
		// else{
		// 	break;
		// }
	}
	if(sat==0){
		var alpha = 0;
	} else{
		var alpha = sat/255;
	}
	var rgb_colors = {
		R: 0,
		G: 0,
		B: 0,
		A: alpha
	};
	var distance_to_prev = hue - prev.start;
	console.log('distance to prev: ', distance_to_prev);
	var color1_amount = 255-(255 * distance_to_prev) / (next.start - prev.start);
	console.log('color 1 amount: ', color1_amount);
	var color1 = current.color;
	var color2 = next.color;
	var distance_to_next = next.start - hue;

	var color2_amount = 255 - color1_amount;
	console.log('color 2 amount: ', color2_amount);
	rgb_colors[color1]=parseInt(color1_amount);
	rgb_colors[color2]=parseInt(color2_amount);
	console.log('rgb_colors: ', rgb_colors);
	return rgb_colors;
}
function display_light_hue_bri_sat(light){
	var icon = light.info.dom_element.find('.icon');
	var rgb = [255, 255, 255];
	if(is_color_bulb(light.info.id)){
        console.log('light.state: ', light.state);
		rgb = convertXYToRGB(light.state.xy[0],light.state.xy[1], light.state.bri);
		if(light.state.on){
            console.log("light info: ", light.info);
			console.log('changing ',light.info.dom_element,' to color ',rgb);
			icon.css('background-color','rgb('+rgb[0]+','+rgb[1]+','+rgb[2]+')');
		} else{
			icon.css('background-color','');
		}
	}
	var opacity = (light.state.bri / 512).toFixed(2);
	if(light.state.on){
		console.log('changing ',light.info.dom_element,' to color ',rgb);
		icon.css('box-shadow','0px 0px .5vw '+opacity+'vw rgba('+rgb[0]+','+rgb[1]+','+rgb[2]+',1)');
	} else{
		icon.css('box-shadow','');
	}
}
function RGBtoXYZ(R, G, B)
{
    var_R = parseFloat( R / 255 );      //R from 0 to 255
    var_G = parseFloat( G / 255 );       //G from 0 to 255
    var_B = parseFloat( B / 255 );        //B from 0 to 255

    if ( var_R > 0.04045 ) var_R =Math.pow( ( ( var_R + 0.055 ) / 1.055 ), 2.4);
    else                   var_R = var_R / 12.92;
    if ( var_G > 0.04045 ) var_G = Math.pow( (( var_G + 0.055 ) / 1.055 ), 2.4);
    else                   var_G = var_G / 12.92;
    if ( var_B > 0.04045 ) var_B = Math.pow( (( var_B + 0.055 ) / 1.055 ), 2.4);
    else                   var_B = var_B / 12.92;

    // var_R = var_R * 100;
    // var_G = var_G * 100;
    // var_B = var_B * 100;

    //Observer. = 2°, Illuminant = D65
    X = var_R * 0.4124 + var_G * 0.3576 + var_B * 0.1805
    Y = var_R * 0.2126 + var_G * 0.7152 + var_B * 0.0722
    Z = var_R * 0.0193 + var_G * 0.1192 + var_B * 0.9505
    return [X, Y, Z]
}

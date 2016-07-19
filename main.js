$(document).ready(initialize);
var bridge_address;
var username=null;
var light_list={};
var interval_timer_ids=[];

function initialize(){
	$("#connect-button").click(connect_to_bridge);
	$("#bridge_ip").on('keypress',update_ip);
	update_ip.call($("#bridge_ip"));//initialize this since I've put the value into the input directly
	attempt_retrieve_username();
	$("#get-light-list-button").click(get_light_list);
}

function attempt_retrieve_username(){
	if(localStorage.username != undefined){
		username = localStorage.username
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
			console.log('success: ',response);
			process_lights(response);
		},
		error_callback: function(response){
			console.log('error: ',response);
		}
	};
	ajax_call(params);
}
function process_lights(lights_object){
	var light_dom;
	for(var i in lights_object){
		lights_object[i].info = {id:i};
		light_list[i] = lights_object[i];
		light_list[i].info.dom_element = display_light(lights_object[i]);
		
		$("#light-list").append(light_list[i].info.dom_element);
	}
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
			console.log('get info success: ',response);
			if(typeof callBack == 'function'){
				if(light_list[light_id]==undefined){
					light_list[light_id] = {};
				}
				light_list[light_id].info = response;
				callBack.call(this,light_id);
			}
		},
		error_callback: function(response){
			console.log('error: ',response);

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
		console.log('don\'t have light info, getting light info and delaying');
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
	console.log('looping color');
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
function alter_light(light_id,properties){
	var user=get_active_user();
	if(!user){
		return;
	}
	var params = {
		url: bridge_ip + '/'+user+'/lights/'+light_id+'/state',
		data: properties,
		method: 'PUT',
		success_callback: function(response){
			console.log('success: ',response);
			if(response[0].success != undefined){
				
				for(var i in response[0].success){
					var response_array = i.split('/');
					light_list[response_array[2]][response_array[3]][response_array[4]] = response[0].success[i];
				}
				display_light_update(response_array,response[0].success[i]);
			}
			
		},
		error_callback: function(response){
			console.log('error: ',response);
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
				break;
			case 'hue':
				break;
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
function display_light(light){
	var state = light.state;
	/*
		<div class="light-div">
			<div class="icon light-on unreachable"><i class="fa fa-lightbulb-o" aria-hidden="true"></i></div>

	*/
	var light_div = $("<div>",{
		class: 'light-div'
	});
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
			console.log('clicked: ',event,light);

			alter_light(light.info.id,{
				hue: calculate_ratio($(this).width(),event.offsetX,65535),
				sat: calculate_ratio($(this).height(),event.offsetY,254),
			});
		});
	}
	var brightness_control = $('<div>').addClass('brightness-bar');
	brightness_control.click(function(){
		alter_light(light.info.id,{
			bri: calculate_ratio($(this).width(),event.offsetX,254)
		});		
	});
	var off_on_container = $("<div>");
	var off_on_control = $("<input>").prop('id','offon_'+light.info.id).attr('type','checkbox').prop('checked',light.state.on);
	var off_on_label = $("<label>").text('ON/OFF').attr('for','offon_'+light.info.id);
	off_on_control.click(function(){
		alter_light(light.info.id,{
			on: !light.state.on
		});
	});
	off_on_container.append(off_on_control,off_on_label);
	light_controls.append(brightness_control,off_on_container);
	light_div.append(light_icon, light_info, light_controls);
	return light_div;

}
function calculate_ratio(element_dimension, property, max){
	var ratio = property / element_dimension;
	var new_value = max * ratio;	
	return Math.floor(new_value);
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
		"devicetype":"danielwpaschal",
	};
	var method = 'POST';
	var success = function(response){
		if(response[0].error != undefined){
			console.log('connection error: ',response)
			console.error(response[0].error.description);
			show_feedback(response[0].error.description,'error');
		}
		else{
			console.log('connection success: ',response);
			username = response[0].success.username;
			localStorage.username = username;
			show_feedback('User connected and saved to localstorage');
		}
		
	}
	var error = function(response){
		console.log('connection error: ',response)
	}
	ajax_call(url,data,method,success,error);
}

function ajax_call(url,data,method,success_callback,error_callback){
	console.log('calling url '+url+' with data ',data);
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
			console.log('success',response);
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
			console.log('error: ',response);
		}
	};
	ajax_call(params);
}
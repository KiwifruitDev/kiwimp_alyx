const Player = require('./classes/player');
const fs = require("fs");
const path = require("path");
const configloc = "./config.json";
const lookout = "KIWI"

var localPlayer;
var config = fs.existsSync(configloc) ? JSON.parse(fs.readFileSync(configloc)) : {};
const header = "alyx-vscript-"+config.channel; // NoobHub header for vscript functions.

// Let's get the vscript paths.
const serverpathdir = path.normalize(config.servervscriptdir);
const serverpaths = [
	path.join(serverpathdir, "server.lua"),
	path.join(serverpathdir, "npcs.lua"),
	path.join(serverpathdir, "nametags.lua"),
];
const clientpath = path.normalize(config.clientvscript)
const clientvscript = fs.existsSync(clientpath)
/*
if(!fs.existsSync(serverpathdir) || !clientvscript) {
	console.log("["+header+"] One or more vscript files are missing! Double check config.json.");
	process.exit(1);
};
*/

var dmg = {};
var dmgkey = 0;

module.exports = {
	updateConfig: (getconfig, client) => {
		if(client) {
			// Update lua files.
			const newclientlua = fs.readFileSync("./lua/client.lua", 'utf8');
			fs.writeFileSync(clientpath, newclientlua, 'utf8');
			const newdamagelua = fs.readFileSync("./lua/damage.lua", 'utf8');
			fs.writeFileSync(path.join(path.dirname(clientpath), "damage.lua"), newdamagelua, 'utf8');
			// These two aren't really needed...
			const newnametaglua = fs.readFileSync("./lua/nametags.lua", 'utf8');
			fs.writeFileSync(path.join(path.dirname(clientpath), "nametags.lua"), newnametaglua, 'utf8');
			const newnpcslua = fs.readFileSync("./lua/npcs.lua", 'utf8');
			fs.writeFileSync(path.join(path.dirname(clientpath), "npcs.lua"), newnpcslua, 'utf8');
		};
		config = getconfig;
	},
	// Create the local player object.
	updatePlayer: (username,authid) => {
		if (!localPlayer)
			localPlayer = new Player(username,authid);
		return localPlayer;
	},
	initVConsole: (hub, constructor) => {
		// VConsole interface, used to pull data without needing to memory spy.
		const net = require('net');
		const client = new net.Socket();
		client.connect(config.vconsoleport, config.vconsoleip, function() {
			console.log('['+header+'] Connected to VConsole.');
		});
		client.on('data', function(data) {
			//console.log('['+header+'] VConsole: '+data);
			data = data.toString();
			// If the data contains the string "KIWI", let's parse it.
			if(data.indexOf(lookout) != -1) {
				const command = data.slice(data.indexOf(lookout) + lookout.length+1); // Remove the KIWI and the space.
				// If PRNT is found at the end of the string, split until then. This marks the end of the command.
				const args = command.substr(0, command.indexOf("PRNT") != -1 ? command.indexOf("PRNT") : command.length).split(" ");
				//console.log('['+header+'] VConsole: '+args.join(" "));
				if(args[0] == "HEADPOS") {
					localPlayer.x = parseFloat(args[1]);
					localPlayer.y = parseFloat(args[2]);
					localPlayer.z = parseFloat(args[3]);
				} else if(args[0] == "HEADANG") {
					localPlayer.pitch= parseFloat(args[1]);
					localPlayer.yaw= parseFloat(args[2]);
					localPlayer.roll= parseFloat(args[3]);
				} else if(args[0] == "LHANDPOS") {
					localPlayer.leftHandX= parseFloat(args[1]);
					localPlayer.leftHandY= parseFloat(args[2]);
					localPlayer.leftHandZ= parseFloat(args[3]);
				} else if(args[0] == "LHANDANG") {
					localPlayer.leftHandPitch= parseFloat(args[1]);
					localPlayer.leftHandYaw= parseFloat(args[2]);
					localPlayer.leftHandRoll= parseFloat(args[3]);
				} else if(args[0] == "RHANDPOS") {
					localPlayer.rightHandX= parseFloat(args[1]);
					localPlayer.rightHandY= parseFloat(args[2]);
					localPlayer.rightHandZ= parseFloat(args[3]);
				} else if(args[0] == "RHANDANG") {
					localPlayer.rightHandPitch= parseFloat(args[1]);
					localPlayer.rightHandYaw= parseFloat(args[2]);
					localPlayer.rightHandRoll= parseFloat(args[3]);
				} else if(args[0] == "DMGSTART") {
					dmg = {};
				} else if(args[0] == "DMGKEY") {
					dmgkey = parseInt(args[1]);
				} else if(args[0] == "DMG") {
					dmg[dmgkey] = parseFloat(args[1]);
				} else if(args[0] == "DMGEND") {
					hub.publish(Object.apply(constructor, {
						action: "damage-vote",
						damage: dmg,
						victim: dmgkey,
						player: localPlayer,
					}));
				}
			}
		});
		client.on('close', function() {
			console.log('['+header+'] VConsole connection closed. Process can not continue, exiting...');
			process.exit(1);
		});
		client.on('error', function(err) {
			console.log('['+header+'] VConsole connection error: '+err);
			process.exit(1);
		});
	},
	updateServer: (userSlots, onlineUsers) => {
		var luaStrings = [
			`Msg("");\n`, // Player heads.
			`Msg("");\n`, // Player NPCS.
			`Msg("");\n`, // Player names.
		];
		var user;
		for(i = 0; i < onlineUsers; i++) {
			user = userSlots[i];
			// TODO: Activate this on production.
			//if(!config.dedicated && user.username == localPlayer.username)
				//continue;
			// Player heads
			luaStrings[0] += `EntityGroup[${i+1}]:SetOrigin(Vector(${user.x},${user.y},${user.z+30}));
EntityGroup[${i+1}]:SetAngles(${user.pitch},${user.yaw},${user.roll});\n`
			// NPCs
			if(config.npccollision) {
				luaStrings[1] += `EntityGroup[${i+1}]:SetOrigin(Vector(${user.x},${user.y},${user.z}));\n`
			}
			// Name tags
			luaStrings[2] += `EntityGroup[${i+1}]:SetOrigin(Vector(${user.x},${user.y},${user.z+40}));
EntityGroup[${i+1}]:SetAngles(0,${user.yaw+90},90);
DoEntFire(EntityGroup[${i+1}]:GetName(), "SetMessage", "${user.username}", 0.0, self, self);\n`
		}
		if(config.writeserver) {
			try {
				// files are not in use, let's write to them
				fs.writeFileSync(serverpaths[0], lua[0], 'utf8');
				fs.writeFileSync(serverpaths[1], lua[1], 'utf8');
				fs.writeFileSync(serverpaths[2], lua[2], 'utf8');
			} catch (err) {
				// let's just rest here because the files are in use.
			}
		}
		return luaStrings;
	},
	updateClient: (lua) => {
		try {
			// files are not in use, let's write to them
			fs.writeFileSync(serverpaths[0], lua[0], 'utf8');
			fs.writeFileSync(serverpaths[1], lua[1], 'utf8');
			fs.writeFileSync(serverpaths[2], lua[2], 'utf8');
		} catch (err) {
			// let's just rest here because the files are in use.
		}
		return lua;
	},
}
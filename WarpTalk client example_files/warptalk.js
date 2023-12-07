class WarpTalk {
	constructor(protocol=window.location.protocol, host=window.location.host) {
		this.joinedRooms = {};
		this.registeredNickname = false;
		// Private properties
		this._protocol = protocol;
		this._host = host;
		this._pingInterval = null;
		this._reconnectAttempts = 0;
		this._httpProtocol = protocol === "ws" ? "http://" : "https://";
		this._baseURL = this._httpProtocol + this._host;
		if (this._baseURL[this._baseURL.length-1] === '/') this._baseURL = this._baseURL.slice(0, -1);
	}

	get _reconnectDelay() {
		return 1000 * Math.pow(1.5, this._reconnectAttempts++);
	}

	connect(callback, nickname= "") {
		let host = `${this._protocol}://${this._host}`
		console.log(`Connecting to ${host}...`);
		this.socket = new WebSocket(host);
		if (this._pingInterval) clearInterval(this._pingInterval);
		this._pingInterval = setInterval(() => {
			this.socket.send(JSON.stringify({"type": "ping"}));
		}, 5000);
		this.socket.addEventListener('open', () => {
			this._reconnectAttempts = 0;
			// Checking if we session with a registered nickname
			this._getRegisteredNickname((info) => {
				if (info.loggedIn) {
					this.registeredNickname = true;
					this.nickname = info.nickname;
				} else {
					this.nickname = nickname;
				}
				this.getRooms((rooms) => {
					this.availableRooms = rooms;
					this.socket.send(JSON.stringify({type: "nickname", "value": this.nickname}));
					let registeredNick = false;
					this.socket.addEventListener('message', (msg) => {
						let data = JSON.parse(msg.data);
						if (data.type !== "confirm" || data.value !== "nickname") return;
						if (registeredNick) return;
						console.log(`Nickname ${this.nickname} registered on server`);
						registeredNick = true;
						if (callback) callback();
					});
				});
			})
		})
		this.socket.addEventListener('message', (msg) => {
			try {
				let data = JSON.parse(msg.data);
				if (data.type == "error") {
					console.warn("Got error from server:", data);
					if (data.errorMessage === "Nickname taken") {
						alert("Nickname is taken or you are trying to connect anonymously multiple times from the same browser session.");
						this.reload();
					}
					return;
				}
				if (data.type === "join") {
					if (this.joinedRooms[data.room]) {
						let room = this.joinedRooms[data.room];
						let alreadyThere = room.clients ? room.clients.map(c => c.nickname).indexOf(data.nickname) > -1 : false;
						room.clients = data.list;
						room.handleClientJoin(data.nickname, alreadyThere);
					}
				}
				if (data.type === "leave") {
					if (this.joinedRooms[data.room]) {
						let room = this.joinedRooms[data.room];
						room.clients = data.list;
						room.handleClientLeave(data.nickname);
					}
				}
				if (data.type === "message") {
					if (!this.joinedRooms[data.room]) return;
					this.joinedRooms[data.room].handleMessage(data);
				}
				if (data.type === "pong") {
					// just for keeping the connection alive.
				}
			} catch (e) {
				console.log(e);
			}
		});
		this.socket.addEventListener('close', () => {
			console.log("Connection server lost, trying to reconnect");
			for (let room in this.joinedRooms) {
				this.joinedRooms[room].handleDisconnect();
			}
			clearInterval(this._pingInterval);
			this._reconnectAttempts++;
			setTimeout(() => {
				this.connect(() => {
					setTimeout(() => {
						for (let room in this.joinedRooms) {
							this.joinedRooms[room].socket = this.socket;
							this.joinedRooms[room].rejoin();
						}
					}, 500);
				});
			}, this._reconnectDelay);
		});
	}

	reload() {
		window.location.reload();
	}

	join(roomName) {
		if (this.joinedRooms[roomName]) return this.joinedRooms[roomName];
		if (!this.availableRooms.map(r => r.name).includes(roomName)) {
			throw Error("No such room");
			return;
		}
		let room = new Room(this.availableRooms.filter(r => r.name === roomName)[0], this.socket);
		this.joinedRooms[roomName] = room;
		this.socket.send(JSON.stringify({"type": "join", "room": roomName}));
		return room;
	}

	leave(roomName) {
		if (!this.joinedRooms[roomName]) return;
		delete this.joinedRooms[roomName];
		this.socket.send(JSON.stringify({"type": "leave", "room": roomName}));
	}

	logout() {
		fetch(this._baseURL + '/logout', {
			mode: 'cors',
			cache: 'no-cache',
			credentials: 'include',
		}).then(() => {
			this.reload();
		}).catch(error => {
			throw error;
		});
	}

	login(nickname, password) {
		fetch(this._baseURL + '/login',{
			method: 'POST',
			mode: 'cors',
			cache: 'no-cache',
			credentials: 'include',
			headers: {
				"Content-Type":  'application/json'
			},
			body: JSON.stringify({nickname, password})
		}).then((res) => {
			this.reload();
		}).catch(error => {
			throw error;
		});
	}

	getRooms(callback) {
		fetch(this._baseURL + '/room', {
			mode: 'cors',
			cache: 'no-cache',
			credentials: 'include',
		}).then(response => {
			return response.json();
		}).then(rooms => {
			callback(rooms);
		})
	}

	isLoggedIn(callback) {
		this._getRegisteredNickname(nick => {
			callback(nick.loggedIn);
		});
	}

	_getRegisteredNickname(callback) {
		fetch(this._baseURL + '/nickname', {
			mode: 'cors',
			cache: 'no-cache',
			credentials: 'include',
		}).then(response => {
			return response.json();
		}).then(data => {
			callback(data);
		})
	}
}

class Room {
	constructor(roomData, socket) {
		this.name = roomData.name;
		this.description = roomData.description;
		this.socket = socket;
		this.listeners = [];
		this.joinListeners = [];
		this.leaveListeners = [];
		this.disconnectListeners = []
	}

	handleMessage(message) {
		this.listeners.forEach(listener => listener(this, message));
	}

	handleClientJoin(nickname, alreadyThere) {
		this.joinListeners.forEach(listener => listener(this, nickname, alreadyThere));
	}

	handleClientLeave(nickname) {
		this.leaveListeners.forEach(listener => listener(this, nickname));
	}

	handleDisconnect() {
		this.disconnectListeners.forEach(listener => listener(this));
	}

	onMessage(listener) {
		this.listeners.push(listener);
	}

	onJoin(listener) {
		this.joinListeners.push(listener);
	}

	onLeave(listener) {
		this.leaveListeners.push(listener);
	}

	onDisconnect(listener) {
		this.disconnectListeners.push(listener);
	}

	send(message) {
		this.socket.send(JSON.stringify({"type": "message", "room": this.name, "message": message}));
	}

	rejoin() {
		this.socket.send(JSON.stringify({"type": "join", "room": this.name}));
	}
}

if (typeof exports !== 'undefined') {
	exports.WarpTalk = WarpTalk;
} else {
	window.WarpTalk = WarpTalk;
}

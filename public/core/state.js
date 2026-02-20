export const Store = {
    user: null,
    userProfile: null,
    currentView: 'landing',
    cache: {},

    // Simple Event Emitter
    _listeners: {},

    on(event, callback) {
        if (!this._listeners[event]) this._listeners[event] = [];
        this._listeners[event].push(callback);
    },

    emit(event, data) {
        if (this._listeners[event]) {
            this._listeners[event].forEach(cb => cb(data));
        }
    },

    setUser(user, profile) {
        this.user = user;
        this.userProfile = profile;
        this.emit('user-changed', { user, profile });
    },

    clear() {
        this.user = null;
        this.userProfile = null;
        this.cache = {};
        this.emit('cleared');
    }
};

/////////////////////////////////////////////////////////////////
// MultiModelExtensionBase 
// Modified version without EventsEmitter dependency
/////////////////////////////////////////////////////////////////

export default class MultiModelExtensionBase extends Autodesk.Viewing.Extension {

  /////////////////////////////////////////////////////////
  // Class constructor
  /////////////////////////////////////////////////////////
  constructor(viewer, options = {}, defaultOptions = {}) {
    super(viewer);

    // Bind event handlers
    this.onModelCompletedLoad = this.onModelCompletedLoad.bind(this);
    this.onObjectTreeCreated = this.onObjectTreeCreated.bind(this);
    this.onModelRootLoaded = this.onModelRootLoaded.bind(this);
    this.onModelActivated = this.onModelActivated.bind(this);
    this.onGeometryLoaded = this.onGeometryLoaded.bind(this);
    this.onToolbarCreated = this.onToolbarCreated.bind(this);
    this.onModelBeginLoad = this.onModelBeginLoad.bind(this);
    this.onModelUnloaded = this.onModelUnloaded.bind(this);
    this.onSelection = this.onSelection.bind(this);

    this.options = Object.assign({}, defaultOptions, options);
    this.viewer = viewer;

    // Track loaded models
    const models = viewer.impl.modelQueue().getModels();
    this.models = models.map((model) => {
      model.guid = model.guid || this.guid(); // Ensure guid exists
      return model;
    });
    console.log('Extension constructor')
    console.log('Loaded models:', this.models);

    this.initializeEvents();
  }

  /////////////////////////////////////////////////////////
  // Extension Id
  /////////////////////////////////////////////////////////
  static get ExtensionId() {
    return 'Viewing.Extension.MultiModelExtensionBase';
  }

  /////////////////////////////////////////////////////////
  // Load callback
  /////////////////////////////////////////////////////////
  load() {
    console.log('MultiModelExtensionBase loaded');
    return true;
  }

  /////////////////////////////////////////////////////////
  // Unload callback
  /////////////////////////////////////////////////////////
  unload() {
    this.viewerEvents.forEach((event) => {
      this.viewer.removeEventListener(event.id, this[event.handler]);
    });
    return true;
  }

  /////////////////////////////////////////////////////////
  // Reload callback (optional)
  /////////////////////////////////////////////////////////
  reload(options = {}) {
    this.options = Object.assign({}, this.options, options);
    return true;
  }

  /////////////////////////////////////////////////////////
  // Default event handlers (can be overridden)
  /////////////////////////////////////////////////////////
  onModelBeginLoad(event) {}
  onModelActivated(event) {}
  onModelRootLoaded(event) {
    if (this.options.loader) this.options.loader.hide();
  }
  onObjectTreeCreated(event) {}
  onGeometryLoaded(event) {}
  onModelCompletedLoad(event) {}
  onToolbarCreated(event) {}
  onModelUnloaded(event) {}
  onSelection(event) {}

  /////////////////////////////////////////////////////////
  // Initialize Viewer Events
  /////////////////////////////////////////////////////////
  initializeEvents() {
    if (this.options.eventSink) {
      // Handle external event sink if provided
      this.eventSink = this.options.eventSink;
      this.eventSink.on('model.loaded', (event) => {
        this.models = [...this.models, event.model];
        this.viewerEvent([
          Autodesk.Viewing.OBJECT_TREE_CREATED_EVENT,
          Autodesk.Viewing.GEOMETRY_LOADED_EVENT
        ]).then((args) => {
          this.onModelCompletedLoad(args[0]);
        });
        this.onModelBeginLoad(event);
      });

      this.eventSink.on('model.activated', (event) => {
        this.onModelActivated(event);
      });

      this.eventSink.on('model.unloaded', (event) => {
        this.models = this.models.filter(model => model.guid !== event.model.guid);
        this.onModelUnloaded(event);
      });
    }

    // Define and attach viewer events
    this.viewerEvents = [
      { id: Autodesk.Viewing.OBJECT_TREE_CREATED_EVENT, handler: 'onObjectTreeCreated' },
      { id: Autodesk.Viewing.MODEL_ROOT_LOADED_EVENT, handler: 'onModelRootLoaded' },
      { id: Autodesk.Viewing.GEOMETRY_LOADED_EVENT, handler: 'onGeometryLoaded' },
      { id: Autodesk.Viewing.TOOLBAR_CREATED_EVENT, handler: 'onToolbarCreated' },
      { id: Autodesk.Viewing.AGGREGATE_SELECTION_CHANGED_EVENT, handler: 'onSelection' }
    ];

    this.viewerEvents.forEach((event) => {
      this.viewer.addEventListener(event.id, this[event.handler]);
    });
  }

  /////////////////////////////////////////////////////////
  // Helper: Wait for multiple viewer events (Promise-based)
  /////////////////////////////////////////////////////////
  viewerEvent(eventId, handler) {
    if (handler) {
      this.viewer.addEventListener(eventId, handler);
      return;
    }

    const eventIdArray = Array.isArray(eventId) ? eventId : [eventId];
    const eventTasks = eventIdArray.map((id) => {
      return new Promise((resolve) => {
        const __handler = (args) => resolve(args);
        this.viewer.addEventListener(id, __handler);
      });
    });

    return Promise.all(eventTasks);
  }

  /////////////////////////////////////////////////////////
  // Helper: Generate a GUID (if needed)
  /////////////////////////////////////////////////////////
  guid() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
}
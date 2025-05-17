export default class PropertySearchExtension extends Autodesk.Viewing.Extension {
  constructor(viewer, options) {
    super(viewer, options);
    this.panel = null;
    this.viewer = viewer;
    this.currentSelectionTool = null;
  }

  load() {
    this.createToolbarButton();
    return true;
  }

  unload() {
    if (this.panel) {
      this.panel.setVisible(false);
    }
    if (this.button) {
      this.viewer.toolbar.removeControl(this.button);
    }
    return true;
  }

  createToolbarButton() {
    const viewer = this.viewer;
    const _this = this;

    function createUI() {
      _this.button = new Autodesk.Viewing.UI.Button('propertySearchBtn');
      _this.button.setToolTip('Filtrar Elementos');
      _this.button.setIcon('adsk-icon-search');
      _this.button.onClick = () => {
        _this.showSearchPanel();
      };

      const subToolbar = new Autodesk.Viewing.UI.ControlGroup('propertySearchToolbar');
      subToolbar.addControl(_this.button);
      viewer.toolbar.addControl(subToolbar);
    }

    if (viewer.toolbar) {
      createUI();
    } else {
      viewer.addEventListener(Autodesk.Viewing.TEXTURES_LOADED_EVENT, createUI);
    }
  }

  showSearchPanel() {
    this.panel = new PropertySearchPanel(this, 'propertySearchPanel', 'Filtrar Elementos', this.viewer);
    this.panel.setVisible(true);
  }
}

class PropertySearchPanel extends Autodesk.Viewing.UI.DockingPanel {
  constructor(extension, id, title, viewer, options = {}) {
    super(viewer.container, id, title);
    this.extension = extension;
    this.viewer = viewer;

    this.container.style.left = (options.x || 10) + 'px';
    this.container.style.top = (options.y || 10) + 'px';
    this.container.style.width = (options.width || 350) + 'px';
    // this.container.style.height = (options.height || 250) + 'px';
    this.container.style.flex = '1'
    this.container.style.resize = 'none';
    this.container.classList.add('docking-panel-container-solid-color');
    this.footer=null;

  }

  initialize() {
    this.title = this.createTitleBar(this.titleLabel || this.container.id);
    this.initializeMoveHandlers(this.title);
    this.container.appendChild(this.title);

    // Panel body
    this.body = document.createElement('div');
    this.body.className = 'docking-panel-body';
    this.body.style.padding = '10px';
    this.body.style.overflowY = 'auto';
    this.body.style.backgroundColor = '#fff';
    this.container.appendChild(this.body);

    // Property name input
    const propNameLabel = document.createElement('label');
    propNameLabel.textContent = 'Property Name:';
    propNameLabel.style.display = 'block';
    propNameLabel.style.marginBottom = '4px';
    this.body.appendChild(propNameLabel);

    this._propNameInput = document.createElement('input');
    this._propNameInput.type = 'text';
    this._propNameInput.style.width = '100%';
    this._propNameInput.style.marginBottom = '10px';
    this.body.appendChild(this._propNameInput);

    // Property value input
    const propValueLabel = document.createElement('label');
    propValueLabel.textContent = 'Property Value:';
    propValueLabel.style.display = 'block';
    propValueLabel.style.marginBottom = '4px';
    this.body.appendChild(propValueLabel);

    this._propValueInput = document.createElement('input');
    this._propValueInput.type = 'text';
    this._propValueInput.style.width = '100%';
    this._propValueInput.style.marginBottom = '10px';
    this.body.appendChild(this._propValueInput);

    // Search button
    this.searchBtn = document.createElement('button');
    this.searchBtn.textContent = 'Search';
    this.searchBtn.style.width = '95%';
    this.searchBtn.style.padding = '6px';
    this.searchBtn.style.marginBottom = '10px';
    this.searchBtn.style.backgroundColor = '#0071b3';
    this.searchBtn.style.color = 'white';
    this.searchBtn.style.border = 'none';
    this.searchBtn.style.borderRadius = '4px';
    this.searchBtn.onclick = (e) => {
        e.preventDefault(); // Prevent default form submission behavior
        e.stopPropagation(); // Stop event bubbling
        this.searchProperties();
    };
    this.body.appendChild(this.searchBtn);

    // Results count
    this.resultsCount = document.createElement('div');
    this.resultsCount.style.marginBottom = '10px';
    this.resultsCount.style.fontSize = '12px';
    this.resultsCount.style.color = '#666';
    this.body.appendChild(this.resultsCount);

    // Results list
    this.resultsList = document.createElement('div');
    this.resultsList.style.maxHeight = '200px';
    this.resultsList.style.overflowY = 'auto';
    this.resultsList.style.border = '1px solid #ddd';
    this.resultsList.style.padding = '5px';
    this.body.appendChild(this.resultsList);

    // Footer with close button
    const footer = document.createElement('div');
    footer.style.padding = '10px';
    footer.style.display = 'flex';
    footer.style.justifyContent = 'flex-end';
    footer.style.backgroundColor = '#f0f0f0';
    footer.style.borderTop = '1px solid #ccc';
    this.footer = footer;

    const closeButton = document.createElement('button');
    closeButton.textContent = 'Close';
    closeButton.style.padding = '6px 12px';
    closeButton.style.border = '1px solid #ccc';
    closeButton.style.borderRadius = '4px';
    closeButton.style.backgroundColor = '#f0f0f0';
    closeButton.onclick = () => {
      if (this.container && this.container.parentNode) {
            this.container.parentNode.removeChild(this.container);
        }
        if (this.extension) {
            this.extension.panel = null;
        }
    };
    footer.appendChild(closeButton);

    this.container.appendChild(footer);
  }

    destroy() {
        if (this.container?.parentNode) {
          this.container.parentNode.removeChild(this.container);
        }
        if (typeof this.uninitialize === 'function') {
          this.uninitialize();
        }
        this.container = null;
        this.content = null;
        this.title = null;
      }

      closePanel() {
        console.log("closePanel")
        this.destroy();
        if (this.extension) this.extension.panel = null;
    }

  async searchProperties() {
    const propName = this._propNameInput.value.trim();
    const propValue = this._propValueInput.value.trim();
    
    console.log('Searching for:', propName, propValue);
    if (!propName) {
      alert('Please enter a property name');
      return;
    }

    this.resultsList.innerHTML = 'Loading...';
    this.viewer.clearSelection();

    try {
      const dbIds = await this.findElementsByProperty(propName, propValue);
      this.displayResults(dbIds);
      
      if (dbIds.length > 0) {
        this.viewer.select(dbIds);
        this.viewer.fitToView(dbIds);
      }
    } catch (error) {
      console.error('Search error:', error);
      this.resultsList.innerHTML = 'Error during search';
    }
  }

async getProperties(dbId, viewer) {
    return new Promise((resolve, reject) => {
        viewer.model.getProperties(dbId, (props) => {
            if (props) {
                resolve(props);
            } else {
                resolve(null); // Caso não haja propriedades
            }
        }, (error) => {
            reject(error);
        });
    });
}


  async findElementsByProperty(propName, propValue) {
    return new Promise((resolve, reject) => {
        const viewer = this.viewer;
        const models = viewer.impl.modelQueue().getModels();
        const matchingDbIds = [];
        
        if (models.length === 0) {
            resolve([]);
            return;
        }

        let modelsProcessed = 0;
        let propertiesFetched = 0;
        let totalPropertiesToFetch = 0;

        // First pass to count total properties to fetch
        models.forEach(model => {
            const instanceTree = model.getData().instanceTree;
            if (!instanceTree) {
                modelsProcessed++;
                return;
            }
            totalPropertiesToFetch += Object.keys(instanceTree.nodeAccess.dbIdToIndex).length;
        });

        if (totalPropertiesToFetch === 0) {
            resolve([]);
            return;
        }

        models.forEach(async model => {
            const instanceTree = model.getData().instanceTree;
            if (!instanceTree) {
                modelsProcessed++;
                checkCompletion();
                return;
            }

            const dbIds = Object.keys(instanceTree.nodeAccess.dbIdToIndex);
            
            if (dbIds.length === 0) {
                modelsProcessed++;
                checkCompletion();
                return;
            }
            totalPropertiesToFetch += dbIds.length;

            for (let i = 0; i < dbIds.length; i++) {
                let dbId = dbIds[i];
                let propertiesFetched = await this.getProperties(Number(dbId), viewer);

                if (!propertiesFetched ) {
                    return;
                }
                if (!propertiesFetched?.properties) {
                    return;
                }
                const foundProp = propertiesFetched.properties.find(p => {
                    // Case-insensitive comparison for property name
                    const nameMatch = p.displayName.toLowerCase().includes(propName.toLowerCase());
                    
                    // If value is specified, check for match (also case-insensitive)
                    if (nameMatch && propValue) {
                        return p.displayValue.toString().toLowerCase().includes(propValue.toLowerCase());
                    }
                    return nameMatch;
                });
                if (foundProp) {
                    console.log("foundProp", foundProp)
                    // Add the dbId to the matching list
                    matchingDbIds.push(Number(dbId));
                }
                propertiesFetched++;
                
                checkCompletion();
            
            }

            modelsProcessed++;
            checkCompletion();
        });

        function checkCompletion() {
            if (modelsProcessed === models.length && propertiesFetched === totalPropertiesToFetch) {
                resolve(matchingDbIds);
            }
        }
    });
}

  displayResults(dbIds) {
    this.resultsCount.textContent = `Found ${dbIds.length} matching elements`;
    
    if (dbIds.length === 0) {
      this.resultsList.innerHTML = 'No elements found with matching properties';
      return;
    }

    this.resultsList.innerHTML = '';
    const maxResultsToShow = 100; // Limit for performance
    
    dbIds.slice(0, maxResultsToShow).forEach(dbId => {
      const resultItem = document.createElement('div');
      resultItem.textContent = `Element ${dbId}`;
      resultItem.style.padding = '4px';
      resultItem.style.cursor = 'pointer';
      resultItem.style.borderBottom = '1px solid #eee';
      
      resultItem.onmouseover = () => {
        this.viewer.isolate([dbId]);
        this.viewer.impl.invalidate(true);
      };
      
      resultItem.onmouseout = () => {
        this.viewer.isolate([]);
        this.viewer.impl.invalidate(true);
      };
      
      resultItem.onclick = () => {
        this.viewer.select(dbId);
        this.viewer.fitToView(dbId);
      };
      
      this.resultsList.appendChild(resultItem);
    });

    if (dbIds.length > maxResultsToShow) {
      const moreItem = document.createElement('div');
      moreItem.textContent = `...and ${dbIds.length - maxResultsToShow} more`;
      moreItem.style.padding = '4px';
      moreItem.style.color = '#666';
      moreItem.style.fontStyle = 'italic';
      this.resultsList.appendChild(moreItem);
    }
  }
}

Autodesk.Viewing.theExtensionManager.registerExtension('PropertySearchExtension', PropertySearchExtension);
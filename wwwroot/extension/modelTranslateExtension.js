export default class TranslateModelExtension extends Autodesk.Viewing.Extension {
  constructor(viewer, options) {
    super(viewer, options);
    this.panel = null;
    this.viewer = viewer;
    this.currentSelectionTool = null;
    this.markersOverlay = null;
  }

  load() {
    this.markersOverlay = this.viewer.impl.createOverlayScene('markersOverlay');

    this.createToolbarButton();
    return true;
  }

  unload() {
    if (this.currentSelectionTool) {
        this.currentSelectionTool.cleanup();
        this.currentSelectionTool = null;
    }

    if (this.button) this.toolbar.removeControl(this.button);
    if (this.panel) this.panel.setVisible(false);
    return true;
  }

  createToolbarButton() {
    const viewer = this.viewer;
    const _this = this;

    function createUI() {
      _this.button = new Autodesk.Viewing.UI.Button('translateModelBtn');
      _this.button.setToolTip('Transladar Modelo');
      _this.button.setIcon('adsk-icon-move');
      _this.button.onClick = () => {
        _this.showModelPanel();
      };

      const subToolbar = new Autodesk.Viewing.UI.ControlGroup('translateModelToolbar');
      subToolbar.addControl(_this.button);
      viewer.toolbar.addControl(subToolbar);
    }

    if (viewer.toolbar) {
      createUI();
    } else {
      viewer.addEventListener(Autodesk.Viewing.TEXTURES_LOADED_EVENT, createUI);
    }
  }

  showModelPanel(){
    console.log('showModelPanel');
    const createPanelConst = createPanel()

    this.panel = new createPanelConst(this, 'showModelsPanel', 'Selecione o modelo para transladar', [], this.viewer);
    this.panel.setVisible(true);
  }
}



function createPanel() {
    return class TranslateModelPanel extends Autodesk.Viewing.UI.DockingPanel 
    {
        constructor(extension, id, title, items = [], theViewer, options = {}) {
            // super(viewer.container, 'translateModelPanel', 'Selecionar Modelo para Translação');
            super(extension.viewer.container, id, title);
            this.extension = extension;
            this.items = items;
            this.viewer = theViewer;

            this.titleLabel = title;

            this.container.style.left = (options.x || 10) + 'px';
            this.container.style.top = (options.y || 10) + 'px';
            this.container.style.width = (options.width || 350) + 'px';
            this.container.style.flex = '1'; // Ocupa o restante da altura
            this.container.style.resize = 'none';
            this.container.style.backgroundColor = 'black'
            this.container.classList.add('docking-panel-container-solid-color');

            this.originPointTool = null;
            this.destinationPointTool = null;
            
            setTimeout(() => {
                this.refreshModelList();
            }, 0);

            setTimeout(() => {
                this.createFooterButtons();
            }, 0);
        }
        breackpoint(body){
          let emptyLabel = document.createElement('label');
          emptyLabel.textContent = ' ';
          emptyLabel.style.display = 'block';
          emptyLabel.style.marginBottom = '4px';
          body.appendChild(emptyLabel);
          return emptyLabel;
        }

        initialize() {
            console.log('TranslateModelPanel initialize');
            this.title = this.createTitleBar(this.titleLabel || this.container.id);
            this.initializeMoveHandlers(this.title);
            this.container.appendChild(this.title);

            // corpo do painel
            this.body = document.createElement('div');
            this.body.className = 'docking-panel-body';
            this.body.style.padding = '10px';
            this.body.style.overflowY = 'auto';
            this.body.style.flex = '1'; // Ocupa o restante da altura
            this.body.style.backgroundColor = '#fff';
            this.container.appendChild(this.body);

            // Dropdown de modelos
            const label = document.createElement('label');
            label.textContent = 'Selecione um modelo:';
            label.style.display = 'block';
            label.style.marginBottom = '4px';
            this.body.appendChild(label);

            this.breackpoint(this.body);

            this.modelSelect = document.createElement('select');
            this.modelSelect.style.width = '100%';
            this.body.appendChild(this.modelSelect);
            
            // Campos de entrada para X, Y, Z
            this.xInput = createInputField('X');
            this.yInput = createInputField('Y');
            this.zInput = createInputField('Z');
            
            this.body.appendChild(this.xInput.wrapper);
            this.body.appendChild(this.yInput.wrapper);
            this.body.appendChild(this.zInput.wrapper);

            // Botões de ponto origem e destino
            this.originBtn = document.createElement('button');
            this.originBtn.textContent = 'Selecionar Ponto de Origem';
            this.originBtn.style.marginBottom = '8px';
            this.body.appendChild(this.originBtn);

            this.originLabel = this.breackpoint(this.body);

            this.destinationBtn = document.createElement('button');
            this.destinationBtn.textContent = 'Selecionar Ponto de Destino';
            this.destinationBtn.style.marginBottom = '12px';
            this.body.appendChild(this.destinationBtn);

            this.destinationLabel = this.breackpoint(this.body);
            
            this.originPoint = null;
            this.destinationPoint = null;

            this.originBtn.onclick = () => {
                this.capturePoint('origin');    
            };

            this.destinationBtn.onclick = () => {
              this.capturePoint('destination');
            };
            
            this.container.appendChild(this.body);
            // Rodapé com botão de fechar
            const footer = document.createElement('div');
            footer.style.padding = '10px';
            footer.style.display = 'flex';
            footer.style.justifyContent = 'space-between';
            footer.style.alignItems = 'center';
            footer.style.backgroundColor = '#f0f0f0';
            footer.style.borderTop = '1px solid #ccc';

            this.footer = footer; 
            this.container.appendChild(footer);
        }

        createInputField(labelText) {
            const wrapper = document.createElement('div');
            wrapper.style.marginBottom = '8px';

            const label = document.createElement('label');
            label.textContent = `${labelText}:`;
            label.style.marginRight = '8px';

            const input = document.createElement('input');
            input.type = 'number';
            input.step = '0.01';
            input.value = '0';
            input.style.width = '80px';

            wrapper.appendChild(label);
            wrapper.appendChild(input);

            return { wrapper, input };
        }


        createFooterButtons(){
            if(!this.footer){
                return;
            }

            const closeButton = document.createElement('button');
            closeButton.textContent = 'Fechar';
            closeButton.style.padding = '6px 12px';
            closeButton.style.fontWeight = 'bold';
            closeButton.style.border = '1px solid #ccc';
            closeButton.style.borderRadius = '4px';
            closeButton.style.backgroundColor = 'var(--primary-1)';
            closeButton.style.color = '#fff';
            closeButton.style.cursor = 'pointer';
        
            closeButton.onclick = () => {
                if (this.container && this.container.parentNode) {
                    this.container.parentNode.removeChild(this.container);
                }
                if (this.extension) {
                    this.extension.panel = null;
                }
                removeMesh(this.viewer, 'origin');
                removeMesh(this.viewer, 'destination');
            };
            this.footer.appendChild(closeButton);
            
            const translateButton = document.createElement('button');
            translateButton.textContent = 'Aplicar Translação';
            translateButton.style.padding = '6px 12px';
            translateButton.style.fontWeight = 'bold';
            translateButton.style.border = '1px solid #ccc';
            translateButton.style.borderRadius = '4px';
            translateButton.style.backgroundColor = 'var(--primary-1)';
            translateButton.style.color = '#fff';
            translateButton.style.cursor = 'pointer';
        
            translateButton.onclick = async () => {
                await this.applyTranslationToSelectedModel();
                removeMesh(this.viewer, 'origin');
                removeMesh(this.viewer, 'destination');
            };
            
            this.footer.appendChild(translateButton);
        }

        async applyTranslationToSelectedModel() {
            const modelId = parseInt(this.modelSelect.value);
            const model = this.viewer.impl.modelQueue().getModels().find(m => m.id === modelId);
            if (!model) {
                alert('Modelo não encontrado.');
                return;
            }

            const x = parseFloat(this.xInput.input.value) || 0;
            const y = parseFloat(this.yInput.input.value) || 0;
            const z = parseFloat(this.zInput.input.value) || 0;

            const currentOffset = model.getGlobalOffset() || new THREE.Vector3(0, 0, 0);
    
            // Calculate new offset
            const newOffset = new THREE.Vector3(
                currentOffset.x + x,
                currentOffset.y + y,
                currentOffset.z + z
            );

            model.setGlobalOffset(newOffset);

            this.viewer.impl.invalidate(true, true, true);
        }


        refreshModelList() {
            this.modelSelect.innerHTML = '';
            if(this.viewer){
                const models = this.viewer.impl.modelQueue().getModels();
                for (const model of models) {
                  const option = document.createElement('option');
                  option.value = model.id;
                  option.textContent = getModelDisplayName(model);

                  this.modelSelect.appendChild(option);
                }
            }
        }



        getSelectedModel() {
            const id = parseInt(this.modelSelect.value);
            return this.viewer.impl.modelQueue().getModels().find(m => m.id === id);
        }

        capturePoint(type) {

          // Clean up any existing tool first
          if (this.currentSelectionTool) {
              this.currentSelectionTool.cleanup();
          }

          this.currentSelectionTool = new PointSelectionTool(this.viewer, type, (point) => {
              if (type === 'origin') {
                  this.originPoint = point;
                  this.originLabel.textContent = `Ponto: (${point.x.toFixed(3)}, ${point.y.toFixed(3)}, ${point.z.toFixed(3)})`;
              } else {
                  this.destinationPoint = point;
                  this.destinationLabel.textContent = `Ponto: (${point.x.toFixed(3)}, ${point.y.toFixed(3)}, ${point.z.toFixed(3)})`;
              }
              
              // Auto-cleanup pós selecao
              this.currentSelectionTool.cleanup();
              this.currentSelectionTool = null;

              this.calculateAndFillDistances();
          });

          // Registrar e ativar
          this.viewer.toolController.registerTool(this.currentSelectionTool);
          this.viewer.toolController.activateTool(this.currentSelectionTool.getName());
        }

        applyTranslationFromPoints() {
            if (!this.originPoint || !this.destinationPoint) {
                alert('Defina os pontos de origem e destino.');
                return;
            }

            const model = this.getSelectedModel();
            if (!model) {
                alert('Modelo não encontrado.');
                return;
            }

            const delta = new THREE.Vector3().subVectors(this.destinationPoint, this.originPoint);
            const currentOffset = model.getGlobalOffset() || new THREE.Vector3(0, 0, 0);
            const newOffset = currentOffset.clone().add(delta);

            model.setGlobalOffset(newOffset);
        }

      calculateAndFillDistances() {
          if (!this.originPoint || !this.destinationPoint) {
              return; 
          }
          
          // const delta = new THREE.Vector3().subVectors(this.destinationPoint, this.originPoint);
          const delta = new THREE.Vector3().subVectors(this.originPoint, this.destinationPoint);
          
          this.xInput.input.value = delta.x.toFixed(3);
          this.yInput.input.value = delta.y.toFixed(3);
          this.zInput.input.value = delta.z.toFixed(3);
          
          console.log(`ds: X=${delta.x}, Y=${delta.y}, Z=${delta.z}`);
      }
  }
}


class PointSelectionTool {
  constructor(viewer, type, callback) {
    this.viewer = viewer;
    this.type = type;
    this.callback = callback;
    this.names = [`PointSelectionTool_${type}`];
    this.originalCursor = '';
    this.active = false;
  }

  getNames() {
    return this.names;
  }

  getName() {
    return this.names[0];
  }

  activate() {
    if (this.active) return;
    console.log('Tool activated');
    this.originalCursor = this.viewer.container.style.cursor;
    this.viewer.container.style.cursor = 'crosshair';
    this.active = true;
    return true;
  }

  deactivate() {
    if (!this.active) return;
    console.log('Tool deactivated');
    this.viewer.container.style.cursor = this.originalCursor;
    this.active = false;
    return true;
  }

   cleanup() {
        this.viewer.toolController.deactivateTool(this.getName());
        this.viewer.toolController.deregisterTool(this);
        // this.removeSelectionMarker();
    }

    

    handleSingleClick(event, button) {
      if (button !== 0) return false;
      this.removePreviousMarker();
      event.stopPropagation();
      event.preventDefault();

      const viewerRect = this.viewer.container.getBoundingClientRect();
      const canvasX = event.clientX - viewerRect.left;
      const canvasY = event.clientY - viewerRect.top;

      const hitTest = this.viewer.impl.hitTest(canvasX, canvasY, true);
    if (hitTest && hitTest.intersectPoint) {

      const worldPoint = hitTest.intersectPoint.clone();
      this.showSelectionMarker(worldPoint);
      this.callback(worldPoint);

      // Clean up
      this.cleanup();
      return true;
    } else {
      alert('Nenhum ponto válido foi clicado.');
      return false;
    }
  }

  showSelectionMarker(point) {
        // Remove previous marker if exists
        // this.removeSelectionMarker();
        
        let color = this.type === 'origin' ? 'blue' : 'red';
        this.createMarker(point, this.type, color, 6);

        this.viewer.impl.invalidate(true, true, true);
    }


    destroy() {
        this.removeSelectionMarker();
        this.viewer = null;
        this.callback = null;
    }

    createColorMaterial (color) {

        const material = new THREE.MeshPhongMaterial({
          specular: new THREE.Color(color),
          side: THREE.DoubleSide,
          reflectivity: 0.0,
          color
        })
    
        const materials = this.viewer.impl.getMaterials()
    
        materials.addMaterial(
          color.toString(16),
          material,
          true)
    
        return material
      }


      createMarker(position, type, color = 'blue', totalHeight = 6) {
    
        const headHeight = totalHeight * 0.15;
        const headRadius = headHeight / 2;
    
        const material = this.createColorMaterial(color);
    
        // Cabeça
        const headGeometry = new THREE.SphereBufferGeometry(headRadius, 32, 32);
        const head = new THREE.Mesh(headGeometry, material);
        head.position.set(position.x, position.y, position.z + headRadius);
        head.name = type;
        head.userData = { isPointMarker: true };
        this.mesh = head;
    
        this.viewer.impl.scene.add(head);
    
        this.viewer.impl.sceneUpdated(true);
      }

      removePreviousMarker() {
        removeMesh(this.viewer, this.type);
    }
}

function createInputField(labelText) {
            const wrapper = document.createElement('div');
            wrapper.style.marginBottom = '8px';

            const label = document.createElement('label');
            label.textContent = `${labelText}:`;
            label.style.marginRight = '8px';

            const input = document.createElement('input');
            input.type = 'number';
            input.step = '0.01';
            input.value = '0';
            input.style.width = '80px';

            wrapper.appendChild(label);
            wrapper.appendChild(input);

            return { wrapper, input };
        }


function getModelDisplayName(model){
    const node = model.getDocumentNode?.();
    if (!node) return `Model ID ${model.id}`;

    // Sobe a hierarquia até encontrar um folder viewable (nome do arquivo)
    let current = node;
    while (current.parent) {
        if (current.parent.data.type === 'folder' && current.parent.data.urn !== undefined && current.parent.data.urn !== null) {
            const name = current.parent.data.name || `Model ID ${model.id}`;
            return name;
        }
        current = current.parent;
    }

    // Fallback: nome do próprio node
    return node.data.name || `Model ID ${model.id}`;
}

function removeMesh(viewer, meshName){
    const scene = viewer.impl.scene;
    let foundMesh = null;
    
    scene.traverse((object) => {
        if (object.name === meshName && object.userData.isPointMarker) {
            foundMesh = object;
        }
    });

    if(foundMesh) {
      viewer.impl.scene.remove(foundMesh);
      viewer.impl.invalidate(true);
      viewer.impl.sceneUpdated(true);
    }
}


Autodesk.Viewing.theExtensionManager.registerExtension('TranslateModelExtension', TranslateModelExtension);

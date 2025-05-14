export default class TranslateModelExtension extends Autodesk.Viewing.Extension {
  constructor(viewer, options) {
    super(viewer, options);
    this.panel = null;
    this.viewer = viewer;
  }

  load() {
    console.log('TranslateModelExtension loaded');
    this.createToolbarButton();
    return true;
  }

  unload() {
    console.log('TranslateModelExtension unloaded');
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
        console.log('Button clicked');
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
    return class TranslateModelPanel extends Autodesk.Viewing.UI.DockingPanel {
        constructor(extension, id, title, items = [], theViewer, applyTranslationFunction = ()=>{} , options = {}) {
            // super(viewer.container, 'translateModelPanel', 'Selecionar Modelo para Translação');
            super(extension.viewer.container, id, title);
            this.extension = extension;
            this.items = items;
            this.viewer = theViewer;

            this.titleLabel = title;
            this.applyTranslationFunction = applyTranslationFunction;

            this.container.style.left = (options.x || 10) + 'px';
            this.container.style.top = (options.y || 10) + 'px';
            this.container.style.width = (options.width || 330) + 'px';
            this.container.style.flex = '1'; // Ocupa o restante da altura
            this.container.style.resize = 'none';
            this.container.classList.add('docking-panel-container-solid-color');
            

            setTimeout(() => {
                this.refreshModelList();
            }, 0);

            setTimeout(() => {
                this.createFooterButtons();
            }, 0);
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
                console.log('Fechar painel');
                if (this.container && this.container.parentNode) {
                    this.container.parentNode.removeChild(this.container);
                }
                if (this.extension) {
                    this.extension.panel = null;
                }
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
                console.log('Aplicar translação painel');
                await this.applyTranslationToSelectedModel();
            };
            
            this.footer.appendChild(translateButton);
        }

        applyingMove(){
            const modelId = parseInt(this.modelSelect.value);
            const model = this.viewer.impl.modelQueue().getModels().find(m => m.id === modelId);
            if (!model) {
                alert('Modelo não encontrado.');
                return;
            }

            const x = parseFloat(this.xInput.input.value) || 0;
            const y = parseFloat(this.yInput.input.value) || 0;
            const z = parseFloat(this.zInput.input.value) || 0;

            this.applyTranslationFunction(this.viewer, model, x, y, z);
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

            const matrix = new THREE.Matrix4().makeTranslation(x, y, z);

            const currentOffset = model.getGlobalOffset() || new THREE.Vector3(0, 0, 0);

    
            // Calculate new offset
            const newOffset = new THREE.Vector3(
                currentOffset.x + x,
                currentOffset.y + y,
                currentOffset.z + z
            );

            model.setGlobalOffset(newOffset);

            this.viewer.impl.invalidate(true, true, true);
            console.log(`Model moved to (${newOffset.x}, ${newOffset.y}, ${newOffset.z})`);

            // const fragList = model.getFragmentList();
            // const count = fragList.getCount();

            // for (let i = 0; i < count; i++) {
            //     fragList.updateFragmentTransform(i, matrix);
            // }
            // fragList.updateAnimTransform();
        }


    refreshModelList() {
        this.modelSelect.innerHTML = '';
        if(this.viewer){
            const models = this.viewer.impl.modelQueue().getModels();
            for (const model of models) {
            const option = document.createElement('option');
            option.value = model.id;
            option.textContent = getModelDisplayName(model);

            console.log('Model:', model);
            console.log('DocNode:', model.getDocumentNode?.());
            console.log('DocNode:', model.getData?.());
            this.modelSelect.appendChild(option);
            }
        }
    }

    
    getSelectedModel() {
        const id = parseInt(this.modelSelect.value);
        return this.viewer.impl.modelQueue().getModels().find(m => m.id === id);
    }
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


class TranslateModelPanelito extends Autodesk.Viewing.UI.DockingPanel {
  constructor(viewer) {
    super(viewer.container, 'translateModelPanel', 'Selecionar Modelo para Translação');
    this.container.classList.add('docking-panel-container');
    this.container.style.width = '300px';
    this.container.style.height = 'auto';
    this.createContent();
  }

  createContent() {
    const div = document.createElement('div');
    div.style.margin = '10px';

    const label = document.createElement('label');
    label.textContent = 'Modelos carregados:';
    div.appendChild(label);

    this.modelSelect = document.createElement('select');
    this.modelSelect.style.width = '100%';
    div.appendChild(this.modelSelect);

    this.refreshButton = document.createElement('button');
    this.refreshButton.textContent = 'Atualizar Lista';
    this.refreshButton.style.marginTop = '10px';
    this.refreshButton.onclick = () => this.refreshModelList();
    div.appendChild(this.refreshButton);

    this.container.appendChild(div);
    this.refreshModelList();
  }

  refreshModelList() {
    this.modelSelect.innerHTML = '';
    if(this.viewer){
        const models = this.viewer.impl.modelQueue().getModels();
        for (const model of models) {
          const option = document.createElement('option');
          option.value = model.id;
          option.textContent = model.urn || `Model ID ${model.id}`;
          this.modelSelect.appendChild(option);
        }
    }
  }

  getSelectedModel() {
    const id = parseInt(this.modelSelect.value);
    return this.viewer.impl.modelQueue().getModels().find(m => m.id === id);
  }
}


Autodesk.Viewing.theExtensionManager.registerExtension('TranslateModelExtension', TranslateModelExtension);

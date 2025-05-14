import { initViewer, loadModel, getMyAccesToken, loadModelNoOptions } from './viewer.js';
// import { loadMultimodelExtension } from './viewer.js';

initViewer(document.getElementById('preview')).then(viewer => {
    setupModelSelection(viewer);
    setupModelUpload(viewer);
    setupCompositeControls(viewer);
    setToggleCompositeDesign();
    setupClearViewerButton(viewer);
    setupTranslatingModelDiv(viewer);
});

let compositeDesigns = [];
let lastInsertedModelUrn = null;

async function setToggleCompositeDesign(){
    document.getElementById('toggle-composite').addEventListener('click', () => {
        const section = document.getElementById('composite-section');
        const isVisible = section.style.display !== 'none' && section.style.display !== '';
        section.style.display = isVisible ? 'none' : 'block';
    });
}

async function setupTranslatingModelDiv(viewer){
    document.getElementById('translate-model').addEventListener('click', () => {
        const section = document.getElementById('transform-section');
        const isVisible = section.style.display !== 'none' && section.style.display !== '';
        section.style.display = isVisible ? 'none' : 'block';
    });

    document.getElementById('apply-transform').addEventListener('click', () => {
        const x = parseFloat(document.getElementById('transform-x').value) || 0;
        const y = parseFloat(document.getElementById('transform-y').value) || 0;
        const z = parseFloat(document.getElementById('transform-z').value) || 0;
        const rotDeg = parseFloat(document.getElementById('transform-rotation').value) || 0;
        const rotRad = rotDeg * Math.PI / 180;

        if (!lastInsertedModelUrn || !loadedUrns.has(lastInsertedModelUrn)) {
            alert('Nenhum modelo recente encontrado para transformar.');
            return;
        }

        const model = loadedUrns.get(lastInsertedModelUrn);
        const fragList = model.getFragmentList();
        const count = fragList.getCount();

        const translation = new THREE.Matrix4().makeTranslation(x, y, z);
        const rotation = new THREE.Matrix4().makeRotationY(rotRad);
        const transform = new THREE.Matrix4().multiplyMatrices(translation, rotation);

        // translateModel(viewer, model, x, y, z);
        console.log(`Model Current Offset: ${model.getGlobalOffset()}`, model.getGlobalOffset());
        moveModel(viewer, model, x, y, z);
        rotateModel(viewer, model, 0, 0, rotRad);

        viewer.impl.invalidate(true, true, true);
    });
}

/**
 * Rotates a model in world space while maintaining its position
 * @param {object} viewer - Forge Viewer instance
 * @param {object} model - Model to rotate
 * @param {number} xAngle - Rotation around X-axis (radians)
 * @param {number} yAngle - Rotation around Y-axis (radians)
 * @param {number} zAngle - Rotation around Z-axis (radians)
 */
function rotateModel(viewer, model, xAngle = 0, yAngle = 0, zAngle = 0) {
    // Get current global offset (or default to zero)
    const offset = model.getGlobalOffset() || new THREE.Vector3(0, 0, 0);

    // Create a rotation matrix (using Euler angles)
    const rotation = new THREE.Matrix4().makeRotationFromEuler(
        new THREE.Euler(xAngle, yAngle, zAngle, 'XYZ')
    );

    // Create a translation matrix (to move model back to its position after rotation)
    const translation = new THREE.Matrix4().makeTranslation(offset.x, offset.y, offset.z);

    // Combine: Translate → Rotate → Translate back to original position
    const transform = new THREE.Matrix4()
        .multiply(translation)          // Move to origin
        .multiply(rotation)             // Apply rotation
        .multiply(translation.clone().invert()); // Move back

    // Apply the new transform
    model.setPlacementTransform(transform);
    
    // Force viewer update
    viewer.impl.invalidate(true, true, true);
}

function moveModel(viewer, model, x = 0, y = 0, z = 0) {
    // Get or create initial offset
    const currentOffset = model.getGlobalOffset() || new THREE.Vector3(0, 0, 0);
    
    // Calculate new offset
    const newOffset = new THREE.Vector3(
        currentOffset.x + x,
        currentOffset.y + y,
        currentOffset.z + z
    );
    
    // Apply offset
    model.setGlobalOffset(newOffset);
    
    // Update viewer
    viewer.impl.invalidate(true, true, true);
    console.log(`Model moved to (${newOffset.x}, ${newOffset.y}, ${newOffset.z})`);
}


async function setupClearViewerButton(viewer) {
    const clearButton = document.getElementById('clear-viewer');
    clearButton.addEventListener('click', () => {
        if (loadedUrns.size > 0) {
            for (const model of loadedUrns.values()) {
                viewer.unloadModel(model);
            }
            loadedUrns.clear();
        }

        viewer.impl.invalidate(true, true, true);
    });
}


async function setupModelSelection(viewer) {
    try {
        const resp = await fetch('/api/models');
        if (!resp.ok) {
            throw new Error(await resp.text());
        }
        let models = await resp.json();
        models.sort((a, b) => a.name.localeCompare(b.name));

        updateSidebarModelList(models, viewer);
    } catch (err) {
        alert('Could not list models. See the console for more details.');
        console.error(err);
    }
}

async function setupModelUpload(viewer) {
    const upload = document.getElementById('upload');
    const input = document.getElementById('input');
    // const models = document.getElementById('models');
    upload.onclick = () => input.click();
    input.onchange = async () => {
        const file = input.files[0];
        let data = new FormData();
        data.append('model-file', file);
        if (file.name.endsWith('.zip')) { // When uploading a zip file, ask for the main design file in the archive
            const entrypoint = window.prompt('Please enter the filename of the main design inside the archive.');
            data.append('model-zip-entrypoint', entrypoint);
        }
        upload.setAttribute('disabled', 'true');
        // models.setAttribute('disabled', 'true');
        showNotification(`Uploading model <em>${file.name}</em>. Do not reload the page.`);
        try {
            const resp = await fetch('/api/models', { method: 'POST', body: data });
            if (!resp.ok) {
                throw new Error(await resp.text());
            }
            const model = await resp.json();
            setupModelSelection(viewer, model.urn);
        } catch (err) {
            alert(`Could not upload model ${file.name}. See the console for more details.`);
            console.error(err);
        } finally {
            clearNotification();
            upload.removeAttribute('disabled');
            // models.removeAttribute('disabled');
            input.value = '';
        }
    };
}

function showNotification(message) {
    const overlay = document.getElementById('overlay');
    overlay.innerHTML = `<div class="notification">${message}</div>`;
    overlay.style.display = 'flex';
}

function clearNotification() {
    const overlay = document.getElementById('overlay');
    overlay.innerHTML = '';
    overlay.style.display = 'none';
}

let loadedUrns = new Map();

async function loadUrnToViewer(urn, viewer){
    try {
        showNotification(`Loading model ${urn}...`);
        
        const accessToken = await getMyAccesToken();
        if (!accessToken) {
            throw new Error('Could not obtain access token');
        }

        const isFirstModel = loadedUrns.size === 0;
        let loadedCleanModel = null;

        if(isFirstModel) {
            // loadedCleanModel = await loadModelNoOptions(viewer, urn);
            const primaryModel = await loadModel(viewer, urn,{
                globalOffset: { x: 0, y: 0, z: 0 },
                placementTransform: new THREE.Matrix4(),
                applyRefPoint: true,
                keepCurrentModels: true
            });
            loadedUrns.set(urn, primaryModel);
        }else{
            // loadedCleanModel = await addViewableWithToken(viewer, urn, accessToken.access_token, null, null);

            const loadOptions = {

                globalOffset:  { x: 0, y: 0, z: 0 },//modelData.globalOffset,//  { x: 0, y: 0, z: 0 },
                placementTransform: new THREE.Matrix4(),
                applyRefPoint: true,
                keepCurrentModels: true
            };

            const model = await addViewableWithToken(viewer, urn, accessToken.access_token, loadOptions.placementTransform, loadOptions.globalOffset);
            loadedUrns.set(urn, model);
        }

        lastInsertedModelUrn = urn;
        clearNotification();
        viewer.showAll();
        
    } catch (err) {
        console.error(`Error loading model ${urn}:`, err);
        event.target.checked = false; // Uncheck the box
        alert(`Failed to load model: ${err.message}`);
    }
}

function updateSidebarModelList(models, viewer) {
    const listContainer = document.getElementById('model-list');
    models.sort((a, b) => a.name.localeCompare(b.name));

    listContainer.innerHTML = models.map(model => `
        <div data-urn="${model.urn}">
            <label class="checkbox-label" data-urn="${model.urn}">
                <input type="checkbox" value="${model.urn}">
                ${model.name}
            </label>
            <button class="delete-model" data-urn="${model.name}" style="margin-left: 8px; color: red;">Excluir</button>
        </div>
    `).join('\n');

    listContainer.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
        checkbox.addEventListener('change', async (event) => {
            const urn = event.target.value;
    
            if (event.target.checked) {
                if (!loadedUrns.has(urn)) {
                    loadUrnToViewer(urn, viewer);
                }
            } else {
                const model = loadedUrns.get(urn);
                if (model) {
                    try {
                        viewer.unloadModel(model);
                        loadedUrns.delete(urn);
                        console.log(`Successfully unloaded ${urn}`);
                    } catch (err) {
                        console.error(`Failed to unload ${urn}:`, err);
                    }
                }
            }
        });
    });

    listContainer.querySelectorAll('.delete-model').forEach(button => {
        button.addEventListener('click', async (event) => {
            const urn = event.target.dataset.urn;
    
            if (!confirm(`Deseja realmente excluir o modelo ${urn}?`)) return;
    
            try {
                const resp = await fetch(`/api/models/${urn}`, { method: 'DELETE' });
                if (!resp.ok) {
                    throw new Error(await resp.text());
                }
    
                // Se estiver carregado, descarrega
                if (loadedUrns.has(urn)) {
                    viewer.unloadModel(loadedUrns.get(urn));
                    loadedUrns.delete(urn);
                }
    
                // Remove da interface
                const modelDiv = listContainer.querySelector(`div[data-urn="${urn}"]`);
                if (modelDiv) modelDiv.remove();
    
                showNotification(`Modelo ${urn} excluído com sucesso.`);
                setTimeout(clearNotification, 2000);
            } catch (err) {
                alert(`Erro ao excluir modelo ${urn}`);
                console.error(err);
            }
        });
    });
    
}

async function addViewableWithToken(viewer, urn, accessToken, xform, offset) {
    return new Promise((resolve, reject) => {
        // Troca o token antes de carregar o modelo
        Autodesk.Viewing.endpoint.HTTP_REQUEST_HEADERS = {
            Authorization: `Bearer ${accessToken}`
        };

        Autodesk.Viewing.Document.load(
            "urn:" + urn,
            (doc) => {
                const viewable = doc.getRoot().getDefaultGeometry();
                const options = {
                    keepCurrentModels: true
                };
                if (xform) options.placementTransform = xform;
                if (offset) options.globalOffset = offset;

                viewer
                    .loadDocumentNode(doc, viewable, options)
                    .then(model => {
                        resolve(model);
                    })
                    .catch(reject);
            },
            (error) => {
                reject(`Erro ao carregar documento ${urn}: ${error}`);
            }
        );
    });
}



// ==========================================================================================
// inserindo functions para buscar agregados

async function createCompositeDesign(name, primaryUrn, secondaryUrns) {
    showNotification(`Creating composite design "${name}"...`);
    
    try {
        const response = await fetch('/api/composite-designs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name,
                primaryUrn,
                secondaryUrns: Array.from(secondaryUrns)
            })
        });
        
        if (!response.ok) {
            throw new Error(await response.text());
        }
        
        const result = await response.json();
        compositeDesigns.push(result);
        renderCompositeDesigns();
        clearNotification();
        return result;
    } catch (err) {
        console.error('Error creating composite:', err);
        alert(`Failed to create composite: ${err.message}`);
        clearNotification();
        throw err;
    }
}

// composite list
function renderCompositeDesigns() {
    const container = document.getElementById('composite-list');
    container.innerHTML = '';
    
    compositeDesigns.forEach(design => {
        const item = document.createElement('div');
        item.className = 'composite-item';
        item.innerHTML = `
            <span>${design.name}</span>
            <button class="load-composite" data-design-id="${design.id}">Load</button>
        `;
        container.appendChild(item);
    });
}

// composite design - esta sendo chamada no renderCompositeDesigns
async function loadCompositeDesign(viewer, design) {
    try {
        // Clear existing models first
        if(loadedUrns.size > 0) {
            for (const model of loadedUrns.values()) {
                viewer.unloadModel(model);
            }
            loadedUrns.clear();
        }
        // Load primary model

        const mainModel = design.models.find(m => m.isMainModel);

        const primaryModel = await loadModel(viewer, mainModel.urn,{
            globalOffset: { x: mainModel.x_offset, y: mainModel.y_offset, z: mainModel.z_offset },
            placementTransform: new THREE.Matrix4(),
            applyRefPoint: true,
            keepCurrentModels: true
        });
        loadedUrns.set(mainModel.urn, primaryModel);

        const accessToken = await getMyAccesToken();
        if (!accessToken) {
            throw new Error('Could not obtain access token');
        }

        const secondaryModels = design.models.filter(m => !m.isMainModel);
        // Load secondary models
        await Promise.all(secondaryModels.map(async (secondary) => {

            const added_model = await addViewableWithToken(
                viewer,
                secondary.urn,
                accessToken.access_token,
                new THREE.Matrix4(),
                { x: secondary.x_offset, y: secondary.y_offset, z: secondary.z_offset },
            )
            loadedUrns.set(secondary.urn, added_model);

        }));
        
        viewer.showAll();

        // Double-check visibility
        viewer.isolate([]); // Hide all
        viewer.showAll(); // Show all
        viewer.fitToView();
    } catch (error) {
        console.error('Failed to load composite design:', error);
        alert('Failed to load composite design. Check console for details.');
    }
}

function setupCompositeControls(viewer) {
    const compositeSection = document.getElementById('composite-section');
    const createBtn = document.getElementById('create-composite');
    
    document.addEventListener('keydown', (e) => {
        if (e.key === 'c' && e.ctrlKey) {
            compositeSection.style.display = compositeSection.style.display === 'none' ? 'block' : 'none';
        }
    });
    
    createBtn.addEventListener('click', async () => {
        const name = document.getElementById('composite-name').value.trim();
        if (!name) {
            alert('Please enter a name for the composite design');
            return;
        }
        
        if (loadedUrns.size < 2) {
            alert('You need at least 2 models loaded to create a composite');
            return;
        }
        
        const urns = Array.from(loadedUrns.keys());
        const primaryUrn = urns[0]; // First loaded model is primary
        const secondaryUrns = urns.slice(1);
        
        const secondaryModels = [];
        for (const urn of secondaryUrns) {
            const model = loadedUrns.get(urn);
            const data = model.getData();
            
            secondaryModels.push({
                urn,
                matrix: data.placementWithOffset?.elements,
                offset: data.globalOffset
            });
        }
        
        await createCompositeDesign(name, primaryUrn, secondaryModels);
    });
    
    fetch('/api/composite-designs')
        .then(res => res.json())
        .then(designs => {
            compositeDesigns = designs;
            renderCompositeDesigns();
        })
        .catch(console.error);



    document.getElementById('composite-list').addEventListener('click', async (e) => {
        if (e.target.classList.contains('load-composite')) {
            const designId = e.target.dataset.designId;
            const design = compositeDesigns.find(d => d.id === designId);
            
            if (design) {
                await loadCompositeDesign(viewer, design);
            }
        }
    });    
}


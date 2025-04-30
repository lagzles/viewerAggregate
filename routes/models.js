const express = require('express');
const formidable = require('express-formidable');
const { listObjects, uploadObject, translateObject, getManifest, urnify, deleteObject } = require('../services/aps.js');

let router = express.Router();

router.get('/api/models', async function (req, res, next) {
    try {
        const objects = await listObjects();
        res.json(objects.map(o => ({
            name: o.objectKey,
            urn: urnify(o.objectId)
        })));
    } catch (err) {
        next(err);
    }
});

router.get('/api/models/:urn/status', async function (req, res, next) {
    try {
        const manifest = await getManifest(req.params.urn);
        if (manifest) {
            let messages = [];
            if (manifest.derivatives) {
                for (const derivative of manifest.derivatives) {
                    messages = messages.concat(derivative.messages || []);
                    if (derivative.children) {
                        for (const child of derivative.children) {
                            messages.concat(child.messages || []);
                        }
                    }
                }
            }
            res.json({ status: manifest.status, progress: manifest.progress, messages });
        } else {
            res.json({ status: 'n/a' });
        }
    } catch (err) {
        next(err);
    }
});

router.post('/api/models', formidable({ maxFileSize: Infinity }), async function (req, res, next) {
    const file = req.files['model-file'];
    if (!file) {
        res.status(400).send('The required field ("model-file") is missing.');
        return;
    }
    try {
        const obj = await uploadObject(file.name, file.path);
        await translateObject(urnify(obj.objectId), req.fields['model-zip-entrypoint']);
        res.json({
            name: obj.objectKey,
            urn: urnify(obj.objectId)
        });
    } catch (err) {
        next(err);
    }
});


router.delete('/api/models/:urn', async (req, res) => {
    try {
        const urn = req.params.urn;
        const objectKey = urn;// Buffer.from(urn, 'base64').toString('utf8'); // reverso do "urnify"
        console.log(`Deleting object `);
        await deleteObject(objectKey);
        res.status(204).end();
    } catch (err) {
        console.error(err);
        res.status(500).send('Erro ao excluir objeto');
    }
});



// In-memory store (replace with database in production)
const compositeDesignsStore = [];

router.get('/api/composite-designs', (req, res) => {
    res.json(compositeDesignsStore);
});

router.post('/api/composite-designs', express.json(), async (req, res) => {
    try {
        const { name, primaryUrn, secondaryUrns } = req.body;
        
        // Create a new composite design
        const design = {
            id: `comp_${Date.now()}`,
            name,
            primaryUrn,
            secondaryModels: secondaryUrns,
            createdAt: new Date().toISOString()
        };
        
        compositeDesignsStore.push(design);
        res.status(201).json(design);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});




module.exports = router;
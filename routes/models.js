const express = require('express');
const formidable = require('express-formidable');
const fs = require('fs');
const path = require('path');

const csvPath = path.join(__dirname, '..', 'composite-designs.csv');


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



router.get('/api/composite-designs', (req, res) => {
    if (!fs.existsSync(csvPath)) {
        return res.json([]);
    }

    try {
        const csvContent = fs.readFileSync(csvPath, 'utf8');
        const lines = csvContent.trim().split('\n');
        const header = lines[0].split(',');

        const designsMap = {};

        lines.slice(1).forEach(line => {
            const parts = line.split(',');

            const id = parts[0];
            const name = parts[1].replace(/^"|"$/g, '');
            const urn = parts[2];
            const isMainModel = parts[3] === 'true';
            const x = parseFloat(parts[4]);
            const y = parseFloat(parts[5]);
            const z = parseFloat(parts[6]);
            const rotation = parseFloat(parts[7]);
            const refId = parts[8] || null;

            const designId = isMainModel ? id : refId;
            if (!designsMap[designId]) {
                designsMap[designId] = {
                    id: designId,
                    name,
                    models: []
                };
            }

            designsMap[designId].models.push({
                id,
                urn,
                isMainModel,
                x_offset: x,
                y_offset: y,
                z_offset: z,
                rotation,
                reference_id: refId
            });
        });

        res.json(Object.values(designsMap));
    } catch (err) {
        console.error('Erro ao ler composite-designs.csv:', err);
        res.status(500).json({ error: 'Erro ao ler os composites salvos.' });
    }
});



router.post('/api/composite-designs', express.json(), async (req, res) => {
    try {
        const { name, primaryUrn, secondaryUrns } = req.body;

        const baseId = `comp_${Date.now()}`;

        // Modelo principal
        const rows = [{
            id: baseId,
            name,
            urn: primaryUrn,
            isMainModel: true,
            x_offset: 0,
            y_offset: 0,
            z_offset: 0,
            rotation: 0,
            reference_id: ''
        }];

        // Modelos secundários
        secondaryUrns.forEach((secondary, index) => {
            rows.push({
                id: `${baseId}_sec${index}`,
                name,
                urn: secondary.urn,
                isMainModel: false,
                x_offset: secondary.offset.x,
                y_offset: secondary.offset.y,
                z_offset: secondary.offset.z,
                rotation: 0,
                reference_id: baseId
            });
        });

        const writeHeaderIfNeeded = !fs.existsSync(csvPath);
        if (writeHeaderIfNeeded) {
            const header = 'id,name,urn,isMainModel,x_offset,y_offset,z_offset,rotation,reference_id\n';
            fs.writeFileSync(csvPath, header, 'utf8');
        }

        for (const row of rows) {
            const line = [
                row.id,
                `"${row.name}"`,
                row.urn,
                row.isMainModel,
                row.x_offset,
                row.y_offset,
                row.z_offset,
                row.rotation,
                row.reference_id || ''
            ].join(',') + '\n';
            fs.appendFileSync(csvPath, line, 'utf8');
        }

        res.status(201).json({ id: baseId, name, models: rows });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});




module.exports = router;
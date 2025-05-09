const { AuthenticationClient, Scopes } = require('@aps_sdk/authentication');
const { OssClient, Region, PolicyKey } = require('@aps_sdk/oss');
const { ModelDerivativeClient, View, OutputType } = require('@aps_sdk/model-derivative');
const { APS_CLIENT_ID, APS_CLIENT_SECRET, APS_BUCKET } = require('../config.js');

const authenticationClient = new AuthenticationClient();
const ossClient = new OssClient();
const modelDerivativeClient = new ModelDerivativeClient();

const service = module.exports = {};

async function getInternalToken() {
    const credentials = await authenticationClient.getTwoLeggedToken(APS_CLIENT_ID, APS_CLIENT_SECRET, [
        Scopes.DataRead,
        Scopes.DataCreate,
        Scopes.DataWrite,
        Scopes.BucketCreate,
        Scopes.BucketRead
    ]);
    return credentials.access_token;
}

service.getViewerToken = async () => {
    return await authenticationClient.getTwoLeggedToken(APS_CLIENT_ID, APS_CLIENT_SECRET, [Scopes.ViewablesRead]);
};


service.ensureBucketExists = async (bucketKey) => {
    const accessToken = await getInternalToken();
    try {
        await ossClient.getBucketDetails(bucketKey, { accessToken });
    } catch (err) {
        if (err.axiosError.response.status === 404) {
            await ossClient.createBucket(Region.Us, { bucketKey: bucketKey, policyKey: PolicyKey.Persistent }, { accessToken});
        } else {
            throw err;
        }
    }
};

service.listObjects = async () => {
    await service.ensureBucketExists(APS_BUCKET);
    const accessToken = await getInternalToken();
    let resp = await ossClient.getObjects(APS_BUCKET, { limit: 64, accessToken });
    let objects = resp.items;
    while (resp.next) {
        const startAt = new URL(resp.next).searchParams.get('startAt');
        resp = await ossClient.getObjects(APS_BUCKET, { limit: 64, startAt, accessToken });
        objects = objects.concat(resp.items);
    }
    return objects;
};

service.uploadObject = async (objectName, filePath) => {
    await service.ensureBucketExists(APS_BUCKET);
    const accessToken = await getInternalToken();
    const obj = await ossClient.uploadObject(APS_BUCKET, objectName, filePath, { accessToken });
    return obj;
};

service.deleteObject = async (objectKey) => {
    const accessToken = await getInternalToken();
    await ossClient.deleteObject(APS_BUCKET, objectKey, { accessToken });
};


service.translateObject = async (urn, rootFilename) => {
    const accessToken = await getInternalToken();
    const job = await modelDerivativeClient.startJob({
        input: {
            urn,
            compressedUrn: !!rootFilename,
            rootFilename
        },
        output: {
            formats: [
                // {
                //     type: OutputType.Svf,
                //     views: [View._2d, View._3d],
                //     advanced: {
                //         generateMasterViews: true,
                //         coordinationModel: true,
                //         hiddenObjects: false,
                //         basicMaterialProperties: true,
                //         autodeskMaterialProperties: true,
                //         buildingStoreys: "show",
                //         spaces: "show"
                //     }
                // },
                {
                    type: OutputType.Svf2,
                    views: [View._3d, View._2d],
                    advanced: {
                        generateMasterViews: true,
                        coordinationModel: true,
                        hiddenObjects: false,
                        basicMaterialProperties: true,
                        autodeskMaterialProperties: true,
                        buildingStoreys: "show",
                        spaces: "show",
                        includeMetadata: true,
                        exportFileStructure: "single"
                    }
                    // advanced: {
                    //     coordinationModel: true,
                    //     generateMasterViews: true,
                    //     buildingStoreys: "show",
                    //     includeMetadata: true,
                    //     exportFileStructure: "single"
                    // }
                }
            ]
        }
    }, { accessToken });
    return job.result;
};

service.getManifest = async (urn) => {
    const accessToken = await getInternalToken();
    try {
        const manifest = await modelDerivativeClient.getManifest(urn, { accessToken });
        return manifest;
    } catch (err) {
        if (err.axiosError.response.status === 404) {
            return null;
        } else {
            throw err;
        }
    }
};

service.urnify = (id) => Buffer.from(id).toString('base64').replace(/=/g, '');
Ext.define('RallyTechServices.RequirementsTracabilityMatrix.utils.exportConfiguration',{

    //initiativeObjectID
    initiativeObjectID: null,
    portfolioItemTypes: null,

    extractFields: null,


    constructor: function(config){
        this.portfolioItemTypes = config.portfolioItemTypes;
        this.initiativeObjectID = config.initiativeObjectID;

        this.extractFields = config.extractFields;
    },
    /**
     * transformRecordsToExtract
     * @param initiatives
     * @param features
     * @param stories
     * @param testCases
     *
     * Using the configuration in this object, transform the data in the records to the desired extract
     *
     */
    transformRecordsToExtract: function(initiatives, features, stories, testCases){
        //console.log('transformRecordsToExtract', initiatives, features, stories, testCases);
        var initiativeMap = {};
        for (var k=0; k<initiatives.length; k++){
            initiativeMap[initiatives[k].get('ObjectID')] = initiatives[k].getData();
        }

        var featureMap = {};
        for (var k=0; k<features.length; k++){
            featureMap[features[k].get('ObjectID')] = features[k].getData();
            if (features[k].Parent){
                features[k].Parent = initiativeMap[features[k].Parent.ObjectID]
            }
        }

        var testCaseMap = {};
        for (var k=0; k<testCases.length; k++){
            var workProductId = testCases[k].get('WorkProduct') && testCases[k].get('WorkProduct').ObjectID;
            if (!testCaseMap[workProductId]){
                testCaseMap[workProductId] = [];
            }
            testCaseMap[workProductId].push(testCases[k].getData());
        }

        var csv = [],
            row = [];

        //start with the column headers
        for (var j= 0; j < this.extractFields.length; j++){
            row.push(this.scrubCell(this.extractFields[j].text));
        }
        csv.push(row.join(','));

        for (var i = 0; i<stories.length; i++){
            var story = stories[i].getData();

            story.TestCases = testCaseMap[story.ObjectID];
            story.Feature = story.Feature && featureMap[story.Feature.ObjectID] || null;
            story.Initiative = story.Feature && story.Feature.Parent || null;

            var row = [];
            for (var j= 0; j < this.extractFields.length; j++){
                var extractField = this.extractFields[j];
                row.push(this.getCellData(extractField, story, initiativeMap, featureMap, testCaseMap))
            }
            csv.push(row.join(','));
        }
        return csv.join('\r\n');
    },
    scrubCell: function(val){
        var re = new RegExp(',|\"|\r|\n','g'),
            reHTML = new RegExp('<\/?[^>]+>', 'g'),
            reNbsp = new RegExp('&nbsp;','ig');

        if (/<br\s?\/?>/.test(val)){
            val = val.replace(/<br\s?\/?>/g,'\n')
        }

        //Strip out HTML tags, too
        if (reHTML.test(val)){
            val = Ext.util.Format.htmlDecode(val);
            val = Ext.util.Format.stripTags(val);
        }

        if (reNbsp.test(val)){
            val = val.replace(reNbsp,' ');
        }

        if (re.test(val)){ //enclose in double quotes if we have the delimiters
            val = val.replace(/\"/g,'\"\"');
            val = Ext.String.format("\"{0}\"",val);
        }

        return val;
    },
    getCellData: function(extractField, artifact, initiativeMap, featureMap, storyTestCaseMap){

        if (!extractField || !extractField.dataIndex){
            return null;
        }

        var val = null;
        if (!extractField.relativeType){
            val = artifact[extractField.dataIndex];
        }

        if (extractField.relativeType === "Feature"){
            var featureId = artifact[this.getFeatureName()].ObjectID;
            val = featureMap[featureId] && featureMap[featureId][extractField.dataIndex];
        }

        if (extractField.relativeType === "Initiative"){
            var featureId = artifact[this.getFeatureName()].ObjectID,
                feature = featureMap[featureId],
                initiativeId = feature && feature['Parent'] && feature['Parent'].ObjectID || null,
                initiative = initiativeId && initiativeMap[initiativeId];

            val = initiative && initiative[extractField.dataIndex];
        }

        if (extractField.relativeType === 'TestCases'){
            var testCases = storyTestCaseMap[artifact.ObjectID];

            if (testCases && testCases.length > 0){
                val = _.pluck(testCases, extractField.dataIndex);
                val = val.join('\n');
            }
        }

        if (Ext.isObject(val)){
            val = val._refObjectName || val.Name;
        }

        return this.scrubCell(val);
    },
    getInitiativeFetch: function(){
        var fetch = ['ObjectID','FormattedID'];
        Ext.Array.each(this.extractFields, function(f){
            if (f.relativeType === 'Initiative'){
                fetch.push(f.dataIndex);
            }
        });
        return fetch;
    },
    getFeatureFetch: function(){
        var fetch = ['ObjectID','FormattedID','Parent'];
        Ext.Array.each(this.extractFields, function(f){
            if (f.relativeType === 'Feature'){
                fetch.push(f.dataIndex);
            }
        });
        return fetch;
    },
    getStoryFetch: function(){
        var fetch = ['ObjectID','FormattedID','TestCases',this.getFeatureName()];
        Ext.Array.each(this.extractFields, function(f){
            if (!f.relativeType){
                fetch.push(f.dataIndex);
            }
        });
        return fetch;
    },
    getTestCaseFetch: function(){
        var fetch = ['ObjectID','FormattedID','Name','LastVerdict','WorkProduct'];
        Ext.Array.each(this.extractFields, function(f){
            if (f.relativeType === 'TestCases'){
                fetch.push(f.dataIndex);
            }
        });
        return fetch;
    },
    getInitiativeObjectID: function(){
        return this.initiativeObjectID;
    },
    getFeatureName: function(){
        return this.portfolioItemTypes[0].replace('PortfolioItem/','');
    },
    getInitiativeConfig: function(){
        return {
            model: this.portfolioItemTypes[1],
            fetch: this.getInitiativeFetch(),
            filters: [{
                property: 'ObjectID',
                value: this.getInitiativeObjectID()
            }]
        };
    },
    getFeatureConfig: function(){
        return {
            model: this.portfolioItemTypes[0],
            fetch: this.getFeatureFetch(),
            filters: [{
                property: 'Parent.ObjectID',
                value: this.getInitiativeObjectID()
            }]
        };
    },
    getStoryConfig: function(){
        var featureName = this.getFeatureName();
        return {
            model: 'HierarchicalRequirement',
            fetch: this.getStoryFetch(),
            filters: [{
                property: featureName + '.Parent.ObjectID',
                value: this.getInitiativeObjectID()
            }]
        };
    },
    getTestCaseConfig: function(stories){
        var filters = [];

        for (var i=0; i<stories.length; i++){
            if (stories[i].get('TestCases') && stories[i].get('TestCases').Count > 0){
                filters.push({
                    property: "WorkProduct.ObjectID",
                    value: stories[i].get('ObjectID')
                });
            }
        }

        if (filters && filters.length > 1){
            filters = Rally.data.wsapi.Filter.or(filters);
        }
        return {
            model: 'TestCase',
            fetch: this.getTestCaseFetch(),
            filters: filters,
            enablePostGet: true
        };
    }
});

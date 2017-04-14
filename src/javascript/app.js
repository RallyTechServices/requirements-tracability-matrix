Ext.define("requirements-traceability-matrix", {
    extend: 'Rally.app.App',
    componentCls: 'app',
    logger: new Rally.technicalservices.Logger(),
    defaults: { margin: 10 },

    integrationHeaders : {
        name : "requirements-traceability-matrix"
    },

    defaultView: [{
        text: 'Contract ID',
        dataIndex: 'Name',
        relativeType: 'Initiative'
    },{
        text: 'Contract Citation',
        dataIndex: 'FormattedID',
        relativeType: 'Feature'
    },{
        text: 'User Story',
        dataIndex: 'FormattedID'
    },{
        text: 'Contract Requirement',
        dataIndex: 'Description'
    },{
        text: 'Contractor Approach',
        dataIndex: 'Notes'
    },{
        text: 'Related Test Cases',
        dataIndex: 'Name',
        relativeType: 'TestCases'
    },{
        text: 'Test Case Results',
        dataIndex: 'LastVerdict',
        relativeType: 'TestCases'
    }],

    portfolioItemTypes: ['PortfolioItem/Feature','PortfolioItem/Initiative'],

    launch: function() {
        //TODO: Load portfolio Item types and views
        this._addComponents();
    },
    _addComponents: function(){
        this.removeAll();
        var executionBox = this.add({
            xtype: 'container',
            layout: 'hbox',
            itemId: 'execution_box',
            padding: 5
        });

        var cbInitiative = executionBox.add({
            xtype: 'rallycombobox',
            storeConfig: {
                model: this.portfolioItemTypes[1],
                fetch: ['FormattedID','ObjectID','Name'],
                remoteFilter: false,
                autoLoad: true,
                limit: Infinity
            },
            fieldLabel: this.getInitiativeName(),
            labelAlign: 'right',
            allowNoEntry: false,
            noEntryText: '',
            noEntryValue: 0,
            itemId: 'cbPortfolioItem',
            margin: 10,
            valueField: 'ObjectID',
            displayField: 'FormattedID',
            width: 600,
            listConfig: {
                itemTpl: '<tpl if="ObjectID &gt; 0">{FormattedID}: {Name}</tpl>'
            },
            filterProperties: ['Name','FormattedID','ObjectID'],
            fieldCls: 'pi-selector',
            displayTpl: '<tpl for=".">' +
            '<tpl if="ObjectID &gt; 0 ">' +
            '{[values["FormattedID"]]}: {[values["Name"]]}' +
            '</tpl>' +
            '<tpl if="xindex < xcount">,</tpl>' +
            '</tpl>'
        });
        cbInitiative.on('select', this.enableExportButton, this);


        var cbView = executionBox.add({
            xtype: 'rallycombobox',
            itemId: 'cbView',
            fieldLabel: 'Select View',
            labelAlign: 'right',
            width: 250,
            store: this.getViewStore(),
            displayField: 'viewName',
            valueField: 'viewObj',
            editable: false,
            margin: 5
        });
        cbView.on('select', this.updateView, this);

        var exportBtn = executionBox.add({
            xtype: 'rallybutton',
            iconCls: 'icon-export',
            itemId: 'btExport',
            cls: 'rly-small primary',
            disabled: true,
            margin: 5
        });
        exportBtn.on('click', this._exportData, this);


    },
    getInitiativeName: function(){
        return this.portfolioItemTypes[1].replace('PortfolioItem/','');
    },
    getFeatureName: function(){
        return this.portfolioItemTypes[0].replace('PortfolioItem/','');
    },
    enableExportButton: function(){
        var enable = this.down('#cbPortfolioItem') && this.down('#cbPortfolioItem').getValue() &&
                this.down('#cbView') && this.down('#cbView').getValue() ? true : false;

        if (this.down('#btExport')){
            this.down('#btExport').setDisabled(!enable);
        }
    },
    updateView: function(cb){
        this.enableExportButton();

        if (this.down('#gridView')){
            this.down('#gridView').destroy();
        }

        var view = cb.getValue() || null;
        if (!view){
            return;
        }

        var typeStore = Ext.create('Rally.data.custom.Store',{
            data: [{
                name: this.getInitiativeName(),
                value: 'Initiative'
            },{
                name: this.getFeatureName(),
                value: 'Feature'
            },{
                name: 'TestCases',
                value: 'TestCases'
            }],
            fields: ['name','value']
        });

        this.add({
            xtype: 'rallygrid',
            store: Ext.create('Rally.data.custom.Store',{
                data: view,
                fields: ['text','dataIndex','relativeType'],
                pageSize: view.length
            }),
            columnCfgs: [{
                dataIndex: 'text',
                text: 'Column Name',
                flex: 1,
                editor: {
                    xtype: 'rallytextfield'
                }
            },{
                dataIndex: 'relativeType',
                text: 'Related Object Type',
                renderer: function(v,m,r){
                    if (!v){
                        return '-- None --';
                    }
                    return v;
                },
                flex: 1,
                editor: {
                    xtype: 'rallycombobox',
                    store: typeStore,
                    displayField: 'name',
                    valueField: 'value',
                    allowNoEntry: true,
                    noEntryText: '-- None --'
                }
            },{
                dataIndex: 'dataIndex',
                text: 'Field Mapping',
                flex: 1,
                editor: {
                    xtype: 'rallyfieldcombobox',
                    model: 'hierarchicalrequirement'
                }
        }],
            showRowActionsColumn: false,
            showPagingToolbar: false
        });

    },
    getViewStore: function(){
        return Ext.create('Rally.data.custom.Store',{
            data: [{
                viewName: 'Default',
                viewObj: this.defaultView
            }],
            fields: ['viewName','viewObj']
        });
    },
    getSelectedInitiativeObjectID: function(){
        return this.down('#cbPortfolioItem') && this.down('#cbPortfolioItem').getValue() || null;
    },
    getSelectedExtractFields: function(){
       return this.down('#cbView').getValue();

    },
    getExportConfig: function(){

        return Ext.create('RallyTechServices.RequirementsTracabilityMatrix.utils.exportConfiguration',{
            portfolioItemTypes: this.portfolioItemTypes,
            initiativeObjectID: this.getSelectedInitiativeObjectID(),
            extractFields: this.getSelectedExtractFields()
        });
    },
    _exportData: function(){
        var exportConfig = this.getExportConfig();
        this.logger.log('_exportData', exportConfig);

        var exporter = Ext.create('RallyTechServices.RequirementsTracabilityMatrix.utils.exporter',{
            exportConfig: exportConfig,
            listeners: {
                scope: this,
                doexporterror: this.showErrorNotification,
                doexportupdate: this.showUpdateNotification,
                doexportcomplete: this.saveExportFile
            }
        });
        exporter.doExport();
    },
    saveExportFile: function(csv){
        Rally.ui.notify.Notifier.hide({});
        this.logger.log('saveExportFile', csv);
        var fileName = Ext.String.format("tracability-matrix-{0}.csv",Rally.util.DateTime.format(new Date(), 'Y-m-d-h-i-s'));
        this.saveCSVToFile(csv,fileName);
    },
    showErrorNotification: function(msg){
        Rally.ui.notify.Notifier.hide();
        this.logger.log('showErrorNotification', msg);
        Rally.ui.notify.Notifier.showError({message: msg});
    },
    showUpdateNotification: function(msg){
        this.logger.log('showUpdateNotification', msg);
        Rally.ui.notify.Notifier.show({message: msg});
    },
    getOptions: function() {
        return [
            {
                text: 'About...',
                handler: this._launchInfo,
                scope: this
            }
        ];
    },
    
    _launchInfo: function() {
        if ( this.about_dialog ) { this.about_dialog.destroy(); }
        this.about_dialog = Ext.create('Rally.technicalservices.InfoLink',{});
    },
    
    isExternal: function(){
        return typeof(this.getAppId()) == 'undefined';
    },
    saveCSVToFile:function(csv,file_name,type_object){
        if (type_object === undefined){
            type_object = {type:'text/csv;charset=utf-8'};
        }
        this.saveAs(csv,file_name, type_object);
    },
    saveAs: function(textToWrite, fileName)
    {
        if (Ext.isIE9m){
            Rally.ui.notify.Notifier.showWarning({message: "Export is not supported for IE9 and below."});
            return;
        }

        var textFileAsBlob = null;
        try {
            textFileAsBlob = new Blob([textToWrite], {type:'text/plain'});
        }
        catch(e){
            window.BlobBuilder = window.BlobBuilder ||
                window.WebKitBlobBuilder ||
                window.MozBlobBuilder ||
                window.MSBlobBuilder;
            if (window.BlobBuilder && e.name == 'TypeError'){
                bb = new BlobBuilder();
                bb.append([textToWrite]);
                textFileAsBlob = bb.getBlob("text/plain");
            }

        }

        if (!textFileAsBlob){
            Rally.ui.notify.Notifier.showWarning({message: "Export is not supported for this browser."});
            return;
        }

        var fileNameToSaveAs = fileName;

        if (Ext.isIE10p){
            window.navigator.msSaveOrOpenBlob(textFileAsBlob,fileNameToSaveAs); // Now the user will have the option of clicking the Save button and the Open button.
            return;
        }

        var url = this.createObjectURL(textFileAsBlob);

        if (url){
            var downloadLink = document.createElement("a");
            if ("download" in downloadLink){
                downloadLink.download = fileNameToSaveAs;
            } else {
                //Open the file in a new tab
                downloadLink.target = "_blank";
            }

            downloadLink.innerHTML = "Download File";
            downloadLink.href = url;
            if (!Ext.isChrome){
                // Firefox requires the link to be added to the DOM
                // before it can be clicked.
                downloadLink.onclick = this.destroyClickedElement;
                downloadLink.style.display = "none";
                document.body.appendChild(downloadLink);
            }
            downloadLink.click();
        } else {
            Rally.ui.notify.Notifier.showError({message: "Export is not supported "});
        }

    },
    createObjectURL: function ( file ) {
        if ( window.URL && window.URL.createObjectURL ) {
            return window.URL.createObjectURL( file );
        }  else if (window.webkitURL ) {
            return window.webkitURL.createObjectURL( file );
        } else {
            return null;
        }
    },
    destroyClickedElement: function(event)
    {
        document.body.removeChild(event.target);
    }
    
});

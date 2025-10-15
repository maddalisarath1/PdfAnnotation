({
    doInit: function(component, event, helper) {
        console.log('=== AURA COMPONENT INITIALIZED ===');
        console.log('Container ready attribute:', component.get('v.containerReady'));
        component.set('v.status', 'Container loading...');
        
        // WORKAROUND: Manually listen for window messages since onmessage doesn't fire
        window.addEventListener('message', function(event) {
            try {
                console.log('=== WINDOW MESSAGE RECEIVED IN AURA ===');
                console.log('Origin:', event.origin);
                console.log('Data:', event.data);
                
                // Parse the message
                var messageData = null;
                try {
                    if (typeof event.data === 'string') {
                        messageData = JSON.parse(event.data);
                    } else {
                        messageData = event.data;
                    }
                } catch(e) {
                    console.log('Not JSON, ignoring');
                    return;
                }
                
                console.log('Parsed message:', messageData);
                
                // Check if it's from our container
                if (!messageData || !messageData.name) {
                    return;
                }
                
                var messageType = messageData.name;
                console.log('Message type:', messageType);
                
                // Handle containerReady
                if (messageType === 'containerReady') {
                    console.log('✓✓✓ CONTAINER IS READY! ✓✓✓');
                    component.set('v.containerReady', true);
                    component.set('v.status', 'Ready to upload PDF');
                    
                    // Check if there's pending PDF data to send
                    var pendingData = component.get('v.pendingPdfData');
                    if (pendingData) {
                        console.log('Sending pending PDF data...');
                        helper.sendPdfToContainer(component, pendingData);
                        component.set('v.pendingPdfData', null);
                    }
                    
                } else if (messageType === 'pdfLoaded') {
                    var numPages = 0;
                    if (messageData.value && messageData.value.numPages) {
                        numPages = messageData.value.numPages;
                    } else if (messageData.numPages) {
                        numPages = messageData.numPages;
                    }
                    
                    console.log('✓ PDF loaded, pages:', numPages);
                    component.set('v.numPages', numPages);
                    component.set('v.status', 'PDF loaded - ' + numPages + ' pages');
                    helper.showToast('Success', 'PDF loaded successfully', 'success');
                    
                } else if (messageType === 'annotationAdded') {
                    console.log('✓ Annotation added');
                    var annotation = null;
                    if (messageData.value && messageData.value.annotation) {
                        annotation = messageData.value.annotation;
                    } else if (messageData.annotation) {
                        annotation = messageData.annotation;
                    }
                    
                    if (annotation) {
                        helper.addAnnotationToList(component, annotation);
                    }
                    
                } else if (messageType === 'exportAnnotations') {
                    console.log('✓ Exporting annotations');
                    var data = null;
                    if (messageData.value && messageData.value.data) {
                        data = messageData.value.data;
                    } else if (messageData.data) {
                        data = messageData.data;
                    }
                    
                    if (data) {
                        helper.downloadJSON(data, 'pdf-annotations.json');
                        helper.showToast('Success', 'Annotations exported', 'success');
                    }
                    
                } else if (messageType === 'error') {
                    var errorMsg = 'Unknown error';
                    if (messageData.value && messageData.value.message) {
                        errorMsg = messageData.value.message;
                    } else if (messageData.message) {
                        errorMsg = messageData.message;
                    }
                    
                    console.error('✗ Error from container:', errorMsg);
                    component.set('v.status', 'Error: ' + errorMsg);
                    helper.showToast('Error', errorMsg, 'error');
                }
            } catch(error) {
                console.error('Error in window message handler:', error);
                console.error('Error stack:', error.stack);
            }
        });
        
        // Test if container exists
        setTimeout(function() {
            var container = component.find('pdfContainer');
            console.log('Container element found:', !!container);
        }, 2000);
    },
    
    handleFileUpload: function(component, event, helper) {
        console.log('File upload triggered');
        
        var files = event.getSource().get('v.files');
        console.log('Files:', files);
        
        if (!files || files.length === 0) {
            console.log('No file selected');
            return;
        }
        
        var file = files[0];
        console.log('File:', file.name, file.type, file.size);
        
        if (file.type !== 'application/pdf') {
            helper.showToast('Error', 'Please select a PDF file', 'error');
            return;
        }
        
        component.set('v.status', 'Reading file...');
        
        var reader = new FileReader();
        reader.onload = function(e) {
            console.log('File read complete, converting to base64...');
            
            var arrayBuffer = e.target.result;
            var bytes = new Uint8Array(arrayBuffer);
            var binary = '';
            for (var i = 0; i < bytes.byteLength; i++) {
                binary += String.fromCharCode(bytes[i]);
            }
            var base64 = btoa(binary);
            
            console.log('Base64 converted, length:', base64.length);
            
            // Check if container is ready
            if (component.get('v.containerReady')) {
                console.log('Container ready, sending PDF...');
                helper.sendPdfToContainer(component, base64);
            } else {
                console.log('Container not ready, waiting...');
                component.set('v.pendingPdfData', base64);
                component.set('v.status', 'Waiting for container...');
            }
        };
        
        reader.onerror = function(error) {
            console.error('Error reading file:', error);
            helper.showToast('Error', 'Failed to read file', 'error');
        };
        
        reader.readAsArrayBuffer(file);
    },
    
    handleMessage: function(component, event, helper) {
        console.log('=== handleMessage TRIGGERED ===');
        console.log('Event object type:', typeof event);
        console.log('Event object:', event);
        
        // Get the message from the event
        var message = event.getParams ? event.getParams() : event;
        console.log('Message extracted:', message);
        
        // Try to get the payload from the message
        var messageData = null;
        
        try {
            // The message should already be extracted from event.getParams()
            if (message) {
                // Try direct access
                if (message.name) {
                    messageData = message;
                }
                // Try payload property
                else if (message.payload) {
                    messageData = typeof message.payload === 'string' 
                        ? JSON.parse(message.payload) 
                        : message.payload;
                }
                // Try value property
                else if (message.value) {
                    messageData = message.value;
                }
            }
            
            console.log('Parsed messageData:', messageData);
            
        } catch(e) {
            console.error('Error parsing message:', e);
            return;
        }
        
        // If we still don't have data, exit
        if (!messageData) {
            console.error('Could not extract message data');
            return;
        }
        
        var messageType = messageData.name || messageData.type;
        console.log('Message type:', messageType);
        
        // Handle different message types
        if (messageType === 'containerReady') {
            console.log('✓ Container is READY!');
            component.set('v.containerReady', true);
            component.set('v.status', 'Ready to upload PDF');
            
            // Check if there's pending PDF data to send
            var pendingData = component.get('v.pendingPdfData');
            if (pendingData) {
                console.log('Sending pending PDF data...');
                helper.sendPdfToContainer(component, pendingData);
                component.set('v.pendingPdfData', null);
            }
            
        } else if (messageType === 'pdfLoaded') {
            var numPages = 0;
            if (messageData.value && messageData.value.numPages) {
                numPages = messageData.value.numPages;
            } else if (messageData.numPages) {
                numPages = messageData.numPages;
            }
            
            console.log('✓ PDF loaded, pages:', numPages);
            component.set('v.numPages', numPages);
            component.set('v.status', 'PDF loaded - ' + numPages + ' pages');
            helper.showToast('Success', 'PDF loaded successfully', 'success');
            
        } else if (messageType === 'annotationAdded') {
            console.log('✓ Annotation added');
            var annotation = null;
            if (messageData.value && messageData.value.annotation) {
                annotation = messageData.value.annotation;
            } else if (messageData.annotation) {
                annotation = messageData.annotation;
            }
            
            if (annotation) {
                helper.addAnnotationToList(component, annotation);
            }
            
        } else if (messageType === 'exportAnnotations') {
            console.log('✓ Exporting annotations');
            var data = null;
            if (messageData.value && messageData.value.data) {
                data = messageData.value.data;
            } else if (messageData.data) {
                data = messageData.data;
            }
            
            if (data) {
                helper.downloadJSON(data, 'pdf-annotations.json');
                helper.showToast('Success', 'Annotations exported', 'success');
            }
            
        } else if (messageType === 'error') {
            var errorMsg = 'Unknown error';
            if (messageData.value && messageData.value.message) {
                errorMsg = messageData.value.message;
            } else if (messageData.message) {
                errorMsg = messageData.message;
            }
            
            console.error('✗ Error from container:', errorMsg);
            component.set('v.status', 'Error: ' + errorMsg);
            helper.showToast('Error', errorMsg, 'error');
            
        } else {
            console.log('Unknown message type:', messageType);
        }
    },
    
    downloadAnnotations: function(component, event, helper) {
        console.log('Download annotations clicked');
        
        if (!component.get('v.containerReady')) {
            helper.showToast('Error', 'Container not ready', 'error');
            return;
        }
        
        var container = component.find('pdfContainer');
        if (container) {
            var message = {
                name: 'exportAnnotations',
                value: {}
            };
            
            console.log('Sending exportAnnotations message');
            
            // Use direct postMessage like we do for PDF upload
            try {
                var iframeElement = container.getElement();
                console.log('Got iframe element:', iframeElement);
                
                if (iframeElement && iframeElement.tagName === 'IFRAME') {
                    console.log('Posting to iframe directly');
                    iframeElement.contentWindow.postMessage(message, '*');
                    console.log('✓ Export message sent');
                } else {
                    var iframe = iframeElement.querySelector('iframe');
                    if (iframe) {
                        console.log('Found iframe via querySelector');
                        iframe.contentWindow.postMessage(message, '*');
                        console.log('✓ Export message sent');
                    } else {
                        console.error('Could not find iframe');
                        helper.showToast('Error', 'Could not find iframe', 'error');
                    }
                }
            } catch(e) {
                console.error('Error sending export message:', e);
                helper.showToast('Error', 'Failed to send export message', 'error');
            }
        }
    },
    
    handleError: function(component, event, helper) {
        console.error('=== CONTAINER ERROR ===');
        console.error('Error event:', event);
        var errorParams = event.getParams();
        console.error('Error params:', errorParams);
    }
})
({
    sendPdfToContainer: function(component, base64Data) {
        console.log('sendPdfToContainer called');
        console.log('PDF data length:', base64Data.length);
        
        try {
            var container = component.find('pdfContainer');
            console.log('Container found:', container);
            
            if (!container) {
                console.error('Container not found');
                this.showToast('Error', 'Container not initialized', 'error');
                return;
            }
            
            var message = {
                name: 'loadPDF',
                value: {
                    pdfData: base64Data
                }
            };
            
            console.log('Preparing to send loadPDF message');
            console.log('Message name:', message.name);
            console.log('PDF data length in message:', message.value.pdfData.length);
            
            // WORKAROUND: Use direct postMessage since container.message() doesn't work
            // Get the iframe element
            var iframeElement = container.getElement();
            console.log('Got iframe element:', iframeElement);
            console.log('Element tag:', iframeElement ? iframeElement.tagName : 'null');
            
            if (iframeElement && iframeElement.tagName === 'IFRAME') {
                console.log('Found IFRAME directly!');
                var targetWindow = iframeElement.contentWindow;
                console.log('Target window:', targetWindow);
                targetWindow.postMessage(message, '*');
                console.log('✓✓✓ Message posted directly to iframe! ✓✓✓');
            } else {
                // Try to find iframe inside the container
                console.log('Not direct IFRAME, searching...');
                var iframe = iframeElement.querySelector('iframe');
                console.log('Searched for iframe, found:', iframe);
                if (iframe) {
                    var targetWindow = iframe.contentWindow;
                    console.log('Target window from search:', targetWindow);
                    targetWindow.postMessage(message, '*');
                    console.log('✓✓✓ Message posted to found iframe! ✓✓✓');
                } else {
                    console.error('Could not find iframe element anywhere');
                    this.showToast('Error', 'Could not find iframe', 'error');
                    return;
                }
            }
            
            component.set('v.status', 'Loading PDF...');
            
        } catch(e) {
            console.error('Error sending message to container:', e);
            console.error('Error stack:', e.stack);
            this.showToast('Error', 'Failed to send PDF: ' + e.message, 'error');
        }
    },
    
    addAnnotationToList: function(component, annotation) {
        try {
            var annotations = component.get('v.annotations') || {};
            var page = annotation.page || 1;
            
            // Create a completely new object to avoid Aura proxy issues
            var newAnnotations = {};
            
            // Copy existing annotations
            for (var key in annotations) {
                if (annotations.hasOwnProperty(key)) {
                    // Copy the array for this page
                    if (Array.isArray(annotations[key])) {
                        newAnnotations[key] = annotations[key].slice(); // Clone the array
                    } else {
                        newAnnotations[key] = [];
                    }
                }
            }
            
            // Add the new annotation
            if (!newAnnotations[page]) {
                newAnnotations[page] = [];
            }
            
            newAnnotations[page].push(annotation);
            
            // Set the completely new object
            component.set('v.annotations', newAnnotations);
            
            // Calculate total annotations
            var total = 0;
            for (var key in newAnnotations) {
                if (newAnnotations.hasOwnProperty(key)) {
                    total += newAnnotations[key].length;
                }
            }
            
            console.log('Annotation added to list, total:', total);
        } catch(e) {
            console.error('Error adding annotation to list:', e);
            console.error('Error stack:', e.stack);
        }
    },
    
    downloadJSON: function(data, filename) {
        var json = JSON.stringify(data, null, 2);
        var blob = new Blob([json], { type: 'application/json' });
        var url = URL.createObjectURL(blob);
        
        var a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        console.log('JSON downloaded:', filename);
    },
    
    showToast: function(title, message, variant) {
        var toastEvent = $A.get('e.force:showToast');
        if (toastEvent) {
            toastEvent.setParams({
                title: title,
                message: message,
                variant: variant,
                mode: 'dismissible'
            });
            toastEvent.fire();
        } else {
            // Fallback for non-Lightning Experience
            console.log('Toast:', title, '-', message);
            alert(title + ': ' + message);
        }
    }
})
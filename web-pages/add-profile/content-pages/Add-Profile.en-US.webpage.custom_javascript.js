<!-- Last modified Tue Oct 21 12:39PM -->
<!-- Last modified Sat Aug 30 10:04AM -->
// Last modified tue aug 12 10:01am
// Last modified wed jul 9 6:01pm
{% comment %}    

~addprofilejss

Add Profile JavaScript for Contact Form - Auto-role assignment enabled
   
{% endcomment %} 

{% comment %}   Add Profile Mode Only   {% endcomment %}

// Mode detection for Add vs Edit
const IS_ADD_MODE = true;

// BEGIN: [Add|Edit]-Profile.en-US.webpage.custom_javascript.js
// 
// Utility functions using jQuery 2506010721 banana
const debounce = (func, delay) => {
	let timeoutId;
	return (...args) => {
		clearTimeout(timeoutId);
		return new Promise((resolve, reject) => {
			timeoutId = setTimeout(async () => {
				try {
					const result = await func.apply(null, args);
					resolve(result);
				} catch (error) {
					reject(error);
				}
			}, delay);
		});
	};
};

// Loading state management
const showLoading = () => {
	$('#loadingOverlay').show();
	$('#contact-form').css('opacity', '0.5');
};

const hideLoading = () => {
	$('#loadingOverlay').hide();
	$('#contact-form').css('opacity', '1');
};

// Simple change tracking - capture complete form state
let initialFormState = {};

// For Add mode, we need different handling than Edit mode
const isAddMode = () => {
	return IS_ADD_MODE || !window.location.href.includes('edit-profile');
};

// Form validation
const validateForm = () => {
	let isValid = true;

	// Check required fields
	$('[required]').each(function() {
		if (!$(this).val().trim()) {
			isValid = false;
			$(this).addClass('invalid');
		} else {
			$(this).removeClass('invalid');
		}
	});

	return isValid;
};

// Display feedback messages
const displayFeedbackMessage = (message, isError = false) => {
	let $feedback = $('#formFeedback');
		
	if (!$feedback.length) {
		// Create feedback element if it doesn't exist
		const $submitButton = $('#userForm button[type="submit"]');
		$submitButton.after('<div id="formFeedback" style="display: inline-block; margin-left: 15px; font-size: 14px; vertical-align: middle;"></div>');
		$feedback = $('#formFeedback');
	}
		
	$feedback.text(message);
	$feedback.css('color', isError ? 'var(--portalThemeColor11)' : 'var(--portalThemeColor10)');
	$feedback.show();

	// Auto-hide after 10 seconds
	setTimeout(() => {
		$feedback.fadeOut();
	}, 10000);
};

// Handle form submission for Add mode (simple submit)
const handleSimpleSubmit = debounce(async (e) => {
	if (e && e.preventDefault) {
		e.preventDefault();
		e.stopPropagation();
	}

	console.log('=== ADD PROFILE SIMPLE SUBMISSION ===');

	if (!validateForm()) {
		displayFeedbackMessage('Please fill in all required fields.', true);
		return;
	}

	showLoading();
	displayFeedbackMessage('Creating new contact...');

	try {
		// Create contact and redirect to Profiles page
		const contactId = await createContact();
		
		displayFeedbackMessage('Contact created successfully! Redirecting...', false);
		
		// Redirect to the Profiles page to see the new contact
		setTimeout(() => {
			window.location.href = `/Accounting/Profiles`;
		}, 2000);

	} catch (error) {
		console.error('Error creating contact:', error);
		displayFeedbackMessage('Error creating contact. Please try again.', true);
		hideLoading();
	}
}, 300);

// Handle form submission for Add mode (with managerial assignments)
const handleManagerialSubmit = debounce(async (e) => {
	if (e && e.preventDefault) {
		e.preventDefault();
		e.stopPropagation();
	}

	console.log('=== ADD PROFILE MANAGERIAL SUBMISSION ===');

	if (!validateForm()) {
		displayFeedbackMessage('Please fill in all required fields.', true);
		return;
	}

	showLoading();
	displayFeedbackMessage('Creating contact and opening assignment manager...');

	try {
		// Create contact and redirect to Edit-Profile
		const contactId = await createContact();
		
		displayFeedbackMessage('Contact created! Opening assignment manager...', false);
		
		// Redirect to Edit-Profile page for assignment management
		setTimeout(() => {
			window.location.href = `/Edit-Profile?id=${contactId}`;
		}, 1500);

	} catch (error) {
		console.error('Error creating contact:', error);
		displayFeedbackMessage('Error creating contact. Please try again.', true);
		hideLoading();
	}
}, 300);

// Shared function to create contact
const createContact = async () => {
	try {
		// Collect form data for new contact creation
		const formData = {
			firstname: $('#firstname').val().trim(),
			lastname: $('#lastname').val().trim(),
			middlename: $('#middlename').val().trim(),
			emailaddress1: $('#emailaddress1').val().trim()
		};

		// Add loan officer if selected
		const loanOfficerSelect = $('#lv_LoanOfficerBind');
		if (loanOfficerSelect.length && loanOfficerSelect.val() && loanOfficerSelect.val() !== '__NONE__') {
			formData['lv_LoanOfficer@odata.bind'] = `/lv_lvcomploanofficers(${loanOfficerSelect.val()})`;
		}

		console.log('Form data to submit:', formData);

		// Create the contact via API
		const createResponse = await apiCall('/_api/contacts', 'POST', formData, true);
		
		console.log('Create response:', createResponse);
		
		// Check if creation was successful (status 201 or 204)
		if (createResponse && (createResponse.success || createResponse.status === 204 || createResponse.status === 201)) {
			console.log('Contact creation API call succeeded');
			
			// Query for the newly created contact using the email address (which should be unique)
			const email = formData.emailaddress1;
			const queryUrl = `/_api/contacts?$filter=emailaddress1 eq '${email}'&$select=contactid,fullname,emailaddress1&$orderby=createdon desc&$top=1`;
			
			console.log('Querying for newly created contact:', queryUrl);
			const queryResponse = await apiCall(queryUrl, 'GET', null, true);
			
			console.log('Query response:', queryResponse);
			
			if (queryResponse && queryResponse.data && queryResponse.data.value && queryResponse.data.value.length > 0) {
				const newContact = queryResponse.data.value[0];
				const contactId = newContact.contactid;
				console.log('Found newly created contact:', contactId, newContact.fullname);
				
				// Handle web role assignments
				const selectedRoles = [];
				$('input[name="webroles[]"]:checked').each(function() {
					selectedRoles.push($(this).val());
				});

				if (selectedRoles.length > 0) {
					console.log('Assigning web roles:', selectedRoles);
					
					// Call the web role flow for each selected role
					const url = window.urlContactWebRole;
					if (url && url.trim() !== '') {
						for (const roleId of selectedRoles) {
							try {
								await apiCall(url, 'POST', {
									"action": "add",
									"contactId": contactId,
									"roleId": roleId
								}, false);
								console.log(`Successfully assigned role ${roleId} to contact ${contactId}`);
							} catch (roleError) {
								console.error(`Failed to assign role ${roleId}:`, roleError);
							}
						}
					} else {
						console.error('❌ CRITICAL ERROR: window.urlContactWebRole is not configured!');
						alert('WARNING: User role assignment system is not properly configured.\n\nThe new user account was created but web roles could not be assigned automatically.\n\nPlease contact your system administrator to:\n1. Configure the role assignment URL in system settings\n2. Manually assign the appropriate web roles to this user\n\nUser roles that need manual assignment: ' + selectedRoles.length + ' role(s)');
					}
				}

				// Return the contactId for the calling function to handle
				return contactId;
				
			} else {
				throw new Error('Could not find the newly created contact - please check the Profiles page');
			}
		} else {
			throw new Error('Contact creation failed - API call unsuccessful');
		}

	} catch (error) {
		console.error('Error creating contact:', error);
		throw error; // Re-throw for the calling function to handle
	}
};

// Initialize the form for Add mode
const initAddForm = () => {
	console.log('=== INITIALIZING ADD PROFILE FORM ===');
	
	// Set up event handlers for both submit buttons
	$('#simpleSubmit').off('click').on('click', function(e) {
		e.preventDefault();
		e.stopPropagation();
		handleSimpleSubmit(e);
	});

	$('#managerialSubmit').off('click').on('click', function(e) {
		e.preventDefault();
		e.stopPropagation();
		handleManagerialSubmit(e);
	});

	// Set focus to First Name field
	setTimeout(() => {
		const firstNameField = $('#firstname');
		if (firstNameField.length) {
			firstNameField.focus();
			console.log('Focus set to First Name field');
		}
	}, 100);

	console.log('Add profile form initialized successfully - both submit buttons configured');
};

// Initialize when DOM is ready
document.addEventListener('LVGlobalDOCReady', function() {
	console.log('LVGlobalDOCReady fired for Add Profile page');
	initAddForm();
});

// Backup initialization in case the global event doesn't fire
$(document).ready(function() {
	console.log('Document ready fired for Add Profile page');
	setTimeout(() => {
		if (!$('#userForm button[type="submit"]').hasClass('initialized')) {
			$('#userForm button[type="submit"]').addClass('initialized');
			initAddForm();
		}
	}, 1000);
});
// Last modified tue aug 12 10:01am
<!-- Last modified Sat Aug 30 10:04AM -->
<!-- Last modified Tue Oct 21 12:39PM -->
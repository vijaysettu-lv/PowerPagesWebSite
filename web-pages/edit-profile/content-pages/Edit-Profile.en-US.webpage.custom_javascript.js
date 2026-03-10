<!-- Last modified Wed Oct 29 4:51PM -->
<!-- Last modified Wed Oct 29 7:59AM -->
<!-- Last modified Mon Sep 29 3:06PM -->
// Last modified Mon 29 2509291413
// // Last modified tue aug 19 7:58am

{% comment %}    

~editprofilejss

Edit Profile JavaScript for Contact Form - Auto-role assignment enabled
   
{% endcomment %} 

{% comment %}   Edit Profile Mode Only    {% endcomment %}


// BEGIN: [Add|Edit]-Profile.en-US.webpage.custom_javascript.js
 
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
	
	// Hide submit button instead of restoring it (since we're about to redirect)
	const $submitButton = $('#userForm button[type="submit"]');
	if ($submitButton.prop('disabled')) {
		$submitButton.hide();
	}
};

// Simple change tracking - capture complete form state
let initialFormState = {};

// NEWAssignTodo8: Assignment management variables  
let looAssignmentChanges = []; // Track assignment changes
let tempAssignmentId = 1; // For generating temporary IDs
let tempLOORemovalId = 1; // For generating unique removal IDs

// Branch Manager functionality
let branchManagerChanges = []; // Track BM changes
let tempBranchManagerId = 1; // For generating temporary IDs
let tempBranchManagerRemovalId = 1; // For generating unique removal IDs

// Loan Officer Exclusion functionality
let exclusionChanges = []; // Track exclusion add/remove changes

const captureCompleteFormState = () => {
	const state = {};
	
	// Get auto-managed role IDs to exclude from change tracking
	const branchRoleId = window.contactFormConfig ? window.contactFormConfig.branchRoleId : '';
	const loanOfficerRoleId = window.contactFormConfig ? window.contactFormConfig.loanOfficerRoleId : '';
	
	// Capture all form inputs (text, select, hidden, etc.)
	$('#userForm :input').each(function() {
		const name = $(this).attr('name');
		if (name) {
			if ($(this).attr('type') === 'checkbox') {
				const roleId = $(this).val();
				// Skip auto-managed role checkboxes in change tracking
				if (name === 'webroles[]' && (roleId === branchRoleId || roleId === loanOfficerRoleId)) {
					dbglog('SKIPPING auto-managed checkbox in state capture: ' + name + ', ' + roleId, 'state');
					return; // Skip this checkbox - don't include in change tracking
				}
				state[name + '_' + $(this).val()] = $(this).is(':checked');
				dbglog('CAPTURED checkbox state: ' + name + '_' + $(this).val() + ', ' + $(this).is(':checked'), 'state');
			} else {
				const value = $(this).val();
				state[name] = (value !== null && value !== undefined) ? value.trim() : '';
			}
		}
	});
	
	// Capture assignment states
	if (window.currentAssignments) {
		state['_assignments'] = JSON.stringify(window.currentAssignments.map(a => a.id).sort());
	}
	if (window.currentBranchManagerAssignments) {
		state['_branchManagerAssignments'] = JSON.stringify(window.currentBranchManagerAssignments.map(a => a.id).sort());
	}
	
	return state;
};

const captureInitialFormData = () => {
	initialFormState = captureCompleteFormState();
};


// Form validation - NEWAssignTodo8: Removed role-specific dropdown validation
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

	// NEWAssignTodo8: No more role-specific required fields for assignments
	const selectedRoles = [];
	$('input[name="webroles[]"]:checked').each(function() {
		const roleId = $(this).val();
		if (roleId) {
			selectedRoles.push(roleId);
		}
	});

	return isValid;
};

// #region Branch Assignment Functions

const displayBranchManagerAssignments = () => {
	console.log('🔴 STEP 2: displayBranchManagerAssignments() called');
	const container = $('#branchManagerList');
	container.empty();

	// Note: window.currentBranchManagerAssignments would need to be populated from server
	const bmAssignments = window.currentBranchManagerAssignments || [];
	console.log('🔴 STEP 2: bmAssignments.length = ' + bmAssignments.length);

	if (bmAssignments.length === 0) {
		container.html('<p style="color: #666; font-style: italic;">No branch management assignments found.</p>');
		return;
	}
	
	// Create table
	const table = $('<table>').addClass('contact-assignments-table');
	
	// Table header
	const thead = $('<thead>');
	const headerRow = $('<tr>');

	headerRow.append(
		$('<th>').text('Action'),
		$('<th>').text('Branch'),
		$('<th>').text('Code'),
		$('<th>').text('Status')
	);

	thead.append(headerRow);
	table.append(thead);
	
	// Table body
	const tbody = $('<tbody>');
	
	// Sort assignments by region, then branch (handle null regions)
	const sortedAssignments = [...bmAssignments].sort((a, b) => {
		// Handle null regions (since regions are disabled)
		const aRegion = a.regionName || '';
		const bRegion = b.regionName || '';
		
		if (aRegion !== bRegion) {
			return aRegion.localeCompare(bRegion);
		}
		
		// Handle null branches (safety check)
		const aBranch = a.branchName || '';
		const bBranch = b.branchName || '';
		
		return aBranch.localeCompare(bBranch);
	});
	
	sortedAssignments.forEach(assignment => {
		const row = $('<tr>').attr({
			'data-bm-assignment-id': assignment.id,
			'data-region': assignment.regionName,
			'data-branch': assignment.branchName
		});
		
		// Action cell with remove button
		const actionCell = $('<td>');
		const removeBtn = $('<a>')
			.html('❌')
			.attr('href', '#')
			.addClass('remove-assignment-icon')
			.attr('title', 'Remove this branch assignment')
			.on('click', function(e) {
				e.preventDefault();
				toggleBranchManagerRemoval(assignment);
			});
		actionCell.append(removeBtn);
		
		// Add action cell first
		row.append(actionCell);

		// Add branch, code, and status cells
		const branchCell = $('<td>').text(assignment.branchName || '(NULL - DATA ERROR)');
		const codeCell = $('<td>').text(assignment.branchCode || '');
		const statusCell = $('<td>').addClass('bm-status-cell');

		// Declare variables for status determination
		let statusText = '';
		let statusClass = '';

		// Check for NULL branch data integrity issue FIRST
		if (assignment.hasNullBranch) {
			// NULL BRANCH - Critical data integrity error
			statusText = assignment.warningMessage || '⚠️ DATA ERROR: NULL Branch';
			statusClass = 'status-null-branch-error';

			// Style the entire row with error highlighting
			row.css({
				'background-color': '#f8d7da',
				'border': '2px solid #f39c12'
			});
			statusCell.css({
				'color': '#721c24',
				'font-weight': 'bold',
				'background-color': '#fff3cd'
			});
			branchCell.css({
				'color': '#721c24',
				'font-weight': 'bold',
				'font-style': 'italic'
			});
		} else {
			// Normal status determination (no null branch issue)
			let statusText = '';
			let statusClass = '';

			if (assignment.isNew) {
				// New assignment not yet saved
				statusText = 'Will be saved on Submit';
				statusClass = 'status-pending-add';
			} else {
				// Check if this assignment is marked for deletion
				const pendingRemoval = branchManagerChanges.find(change =>
					change.action === 'remove' &&
					change.assignmentId === assignment.id
				);

				if (pendingRemoval) {
					statusText = 'Will be deleted on Submit';
					statusClass = 'status-pending-delete';
				} else {
					statusText = ''; // Blank for saved status
					statusClass = 'status-saved';
				}
			}

			statusCell.text(statusText).addClass(statusClass);

			// Add inline styles for better visual feedback
			if (statusClass === 'status-pending-add') {
				statusCell.css({'color': '#28a745', 'font-weight': 'bold'});  // Green for new
			} else if (statusClass === 'status-pending-delete') {
				statusCell.css({'color': '#dc3545', 'font-weight': 'bold'});  // Red for deletion, no strikethrough
				// Apply strikethrough to other cells but not status cell
				row.css({'opacity': '0.6'});
				row.find('td:not(.bm-status-cell)').css({'text-decoration': 'line-through'});
			} else if (statusClass === 'status-saved') {
				// No special styling for saved status (blank)
			}
		}

		statusCell.text(statusText).addClass(statusClass);

		row.append(branchCell, codeCell, statusCell);
		tbody.append(row);

		// NOTE: Exclusion UI has been moved to a separate subsection
		// Exclusions are now managed via the "Loan Officer Exclusions" section
		// which allows adding exclusions for ANY loan officer company-wide
	});

	table.append(tbody);
	container.append(table);

	// Update the summary label in the header
	if (typeof updateAssignmentSummaryLabel === 'function') {
		updateAssignmentSummaryLabel();
	}
};

// ============================================================
// REMOVED: Old branch-based exclusion UI functions
// The following functions are NO LONGER USED:
//   - createExclusionRowForBranch
//   - getLOExclusionCount
//   - trackExclusionChange
//   - updateExclusionHeaderCount
// Exclusions are now per-user, managed via displayLOExclusions()
// See docs/ContactAssignment_Refactoring_Plan.md for details
// ============================================================

const toggleBranchManagerRemoval = (assignment) => {
	if (assignment.isNew) {
		// For newly added assignments (not yet saved), simply remove completely
		dbglog('🔍 STATUS: Removing new assignment completely: ' + assignment.branchName, 'assignment');
		
		// Remove from current assignments display
		const index = window.currentBranchManagerAssignments.findIndex(a => a.id === assignment.id);
		if (index !== -1) {
			window.currentBranchManagerAssignments.splice(index, 1);
		}
		
		// Remove from changes array (find the add change and remove it)
		const changeIndex = branchManagerChanges.findIndex(change => 
			change.action === 'add' && change.tempAssignment && change.tempAssignment.id === assignment.id
		);
		if (changeIndex !== -1) {
			branchManagerChanges.splice(changeIndex, 1);
		}
		
		// Refresh display and update indicator
		displayBranchManagerAssignments();
		updateChangeIndicator();

		// Refresh the branch dropdown to add back the removed branch
		const cfgRegionEnabled = typeof window.cfgRegionEnabled !== 'undefined' ? window.cfgRegionEnabled : true;
		if (!cfgRegionEnabled) {
			handleBMRegionChange();
		}

		// Refresh exclusion display (simplified - no branch dropdown needed)
		displayLOExclusions();

		// Sync auto-managed roles when assignments change
		if (typeof syncAutoManagedRoles === 'function') {
			syncAutoManagedRoles();
		}
	} else {
		// For existing assignments, check if already marked for deletion
		const existingRemovalIndex = branchManagerChanges.findIndex(change => 
			change.action === 'remove' && change.assignmentId === assignment.id
		);
		
		if (existingRemovalIndex !== -1) {
			// Already marked for deletion - undo the removal (restore the assignment)
			dbglog('🔍 STATUS: Undoing deletion for: ' + assignment.branchName, 'assignment');
			branchManagerChanges.splice(existingRemovalIndex, 1);
		} else {
			// Not marked for deletion - mark it for deletion
			dbglog('🔍 STATUS: Marking for deletion: ' + assignment.branchName, 'assignment');
			branchManagerChanges.push({
				id: `remove-bm-${tempBranchManagerRemovalId++}`,
				action: 'remove',
				assignmentId: assignment.id,
				regionName: assignment.regionName,
				branchName: assignment.branchName
			});
		}
		
		// Refresh display to update status
		displayBranchManagerAssignments();
		updateChangeIndicator();

		// Refresh exclusion display
		displayLOExclusions();

		// Sync auto-managed roles when assignments change
		if (typeof syncAutoManagedRoles === 'function') {
			syncAutoManagedRoles();
		}
	}
};

const handleBMRegionChange = () => {
	const regionSelect = $('#bmRegionSelect');
	const branchSelect = $('#bmBranchSelect');
	const confirmBtn = $('#confirmAddBranchManager');
	const selectedRegion = regionSelect.val();
	
	// Check if regions are enabled
	const cfgRegionEnabled = typeof window.cfgRegionEnabled !== 'undefined' ? window.cfgRegionEnabled : true;
	
	// Clear and disable downstream selects
	branchSelect.find('option:not(:first)').remove();
	branchSelect.prop('selectedIndex', 0);
	confirmBtn.prop('disabled', true);
	
	// Since regions are disabled, show ALL branches from branchData
	if (window.branchData && window.branchData.length > 0) {
		// Get all branch names (already sorted from server)
		const allBranches = window.branchData.map(b => b.branchName);
		
		// Get already assigned branch names to exclude them
		const assignedBranchNames = (window.currentBranchManagerAssignments || []).map(assignment => assignment.branchName);
		
		// Filter out already assigned branches
		const availableBranches = allBranches.filter(branchName => !assignedBranchNames.includes(branchName));
		
		// Populate branch dropdown with all available branches
		availableBranches.forEach(branchName => {
			$('<option>', {
				value: branchName,
				text: branchName
			}).appendTo(branchSelect);
		});
		
		// Enable branch dropdown
		branchSelect.prop('disabled', false);
	}

};

const handleBMBranchChange = () => {
	const branchSelect = $('#bmBranchSelect');
	const confirmBtn = $('#confirmAddBranchManager');
	const selectedBranch = branchSelect.val();
	
	confirmBtn.prop('disabled', !selectedBranch);
};

const addBranchManagerAssignment = () => {
	const regionName = $('#bmRegionSelect').val();
	const branchName = $('#bmBranchSelect').val();
	
	if (!branchName) {
		alert('Please select a branch');
		return;
	}
	
	// Since regions are disabled, find branch information from branchData
	const branchInfo = window.branchData.find(b => b.branchName === branchName);
	
	if (!branchInfo) {
		alert('Error: Could not find branch information');
		return;
	}
	
	// Check if assignment already exists (only check branch name since no regions)
	const bmAssignments = window.currentBranchManagerAssignments || [];
	const alreadyExists = bmAssignments.some(a => a.branchName === branchName);
	
	if (alreadyExists) {
		alert('This branch assignment already exists');
		return;
	}
	
	// Check if being removed and this would undo that
	const removalChangeIndex = branchManagerChanges.findIndex(change => 
		change.action === 'remove' && 
		change.branchName === branchName
	);
	
	if (removalChangeIndex !== -1) {
		// Just undo the removal
		branchManagerChanges.splice(removalChangeIndex, 1);
		displayBranchManagerAssignments();
		return;
	}
	
	// Create temporary assignment for display
	const tempAssignment = {
		id: `temp-bm-${tempBranchManagerId++}`,
		regionName: null, // No region since regions are disabled
		branchName: branchName,
		branchCode: branchInfo.branchCode,
		branchId: branchInfo.branchId,
		isNew: true
	};
	
	// Add to current assignments for display
	if (!window.currentBranchManagerAssignments) {
		window.currentBranchManagerAssignments = [];
	}
	window.currentBranchManagerAssignments.push(tempAssignment);
	
	// Track the change
	const changeId = `add-bm-${tempAssignment.id}`;
	branchManagerChanges.push({
		id: changeId,
		action: 'add',
		regionName: null, // No region since regions are disabled
		branchName: branchName,
		branchCode: branchInfo.branchCode, // NEW: Required for new table
		regionId: null, // No region since regions are disabled
		branchId: branchInfo.branchId, // Use branchInfo instead of regionBranch
		tempAssignment: tempAssignment
	});
	
	// Reset form (since regions are disabled, always use no-region mode)
	$('#bmBranchSelect').prop('selectedIndex', 0);
	$('#confirmAddBranchManager').prop('disabled', true);

	// Refresh display
	displayBranchManagerAssignments();

	// Refresh the branch dropdown to remove the just-added branch
	if (typeof handleBMRegionChange === 'function') {
		handleBMRegionChange();
	}

	// Refresh exclusion display
	displayLOExclusions();

	updateChangeIndicator();
};

const cancelAddBranchManager = () => {
	// Hide add controls
	$('#addBranchManagerControls').hide();
	$('#addBranchManagerLink').show();
	
	// Reset form
	$('#bmRegionSelect').prop('selectedIndex', 0);
	$('#bmBranchSelect').prop('selectedIndex', 0);
	$('#confirmAddBranchManager').prop('disabled', true);
};

const initBranchManagerManagement = () => {	
	// Initialize branch manager assignments if not already set
	if (!window.currentBranchManagerAssignments) {
		window.currentBranchManagerAssignments = [];
	}
	
	// Handle region visibility for Branch Manager section
	const cfgRegionEnabled = typeof window.cfgRegionEnabled !== 'undefined' ? window.cfgRegionEnabled : true;
	
	if (!cfgRegionEnabled) {
		// Hide region dropdown
		$('#bmRegionSelect').closest('.form-group').hide();
		
		// When regions are disabled, populate branch dropdown with ALL branches
		if (window.branchData && window.branchData.length > 0) {
			const branchSelect = $('#bmBranchSelect');
			
			// Get all branch names
			const allBranches = window.branchData.map(b => b.branchName);
			
			// Get already assigned branch names to exclude them
			const assignedBranchNames = window.currentBranchManagerAssignments.map(assignment => assignment.branchName);
			
			// Filter out already assigned branches
			const availableBranches = allBranches.filter(branchName => !assignedBranchNames.includes(branchName));
			
			// Populate branch dropdown with all available branches
			branchSelect.find('option:not(:first)').remove(); // Clear existing options except first
			availableBranches.forEach(branchName => {
				// Find the branch data to get the code
				const branchInfo = window.branchData.find(b => b.branchName === branchName);
				const displayText = branchInfo && branchInfo.branchCode 
					? `${branchName} (${branchInfo.branchCode})`
					: branchName;
				
				$('<option>', {
					value: branchName,
					text: displayText
				}).appendTo(branchSelect);
			});
			
			// Enable branch dropdown since it's now populated
			branchSelect.prop('disabled', false);
		}
	}
	
	// Display current BM assignments
	displayBranchManagerAssignments();
	
	// Setup event handlers for BM controls
	$('#addBranchManagerLink').on('click', function(e) {
		e.preventDefault();
		$(this).hide();
		$('#addBranchManagerControls').show();
		
		// Auto-open the branch dropdown for better UX
		setTimeout(() => {
			const branchSelect = document.getElementById('bmBranchSelect');
			
			if (branchSelect && !branchSelect.disabled) {
				branchSelect.focus();
				
				// Try multiple methods to open the dropdown
				branchSelect.click();
				
				// Alternative method for some browsers - expand dropdown by showing multiple options
				if (branchSelect.size <= 1) {
					branchSelect.size = Math.min(branchSelect.options.length, 10);
					
					// Reset to normal dropdown when user makes a selection
					const resetDropdown = () => {
						branchSelect.size = 1;
						branchSelect.removeEventListener('change', resetDropdown);
					};
					branchSelect.addEventListener('change', resetDropdown);
				}
				
			} else {
			}
		}, 100); // Small delay to ensure controls are fully displayed
	});
	
	// Auto-add branch assignment on dropdown selection
	$('#bmBranchSelect').on('change', function() {
		const selectedBranch = $(this).val();
		
		if (selectedBranch && selectedBranch !== '') {
			dbglog('🔍 AUTO-ADD: Branch selected: ' + selectedBranch, 'assignment');
			
			// Add the assignment
			addBranchManagerAssignment();
			
			// Reset dropdown to prompt (keep controls visible for next assignment)
			$(this).val('').prop('selectedIndex', 0);
			
			// Refresh the branch dropdown options to exclude newly assigned branch
			if (typeof handleBMRegionChange === 'function') {
				handleBMRegionChange();
			}
			
			dbglog('🔍 AUTO-ADD: Branch assignment added, dropdown reset and ready for next assignment', 'assignment');
		}
	});

	// REMOVED: Old branch-based exclusion checkbox event handlers
	// Exclusions are now managed via the per-user model in initLOExclusionManagement()
};

// #endregion Branch Assignment 

// NEWAssignTodo8: Assignment Management Functions

const displayContactAssignments = () => {
	const container = $('#looAssignmentsList');
	container.empty();
	
	// Filter out assignments with missing officer information
	const validAssignments = window.currentAssignments.filter(assignment => 
		assignment.officerId && assignment.officerName
	);
	
	if (validAssignments.length === 0) {
		container.html('<p style="color: #666; font-style: italic;">No assignments found.</p>');
		return;
	}
	
	// Create table
	const table = $('<table>').addClass('contact-assignments-table');
	
	// Table header
	const thead = $('<thead>');
	const headerRow = $('<tr>');

	headerRow.append(
		$('<th>').text('Action'),
		$('<th>').text('Loan Officer'),
		$('<th>').text('Status')
	);

	thead.append(headerRow);
	table.append(thead);
	
	// Table body
	const tbody = $('<tbody>');
	
	// Sort assignments by region, then branch (handle null values)
	const sortedAssignments = [...validAssignments].sort((a, b) => {
		const aRegion = a.regionName || '';
		const bRegion = b.regionName || '';
		const aBranch = a.branchName || '';
		const bBranch = b.branchName || '';
		
		if (aRegion !== bRegion) {
			return aRegion.localeCompare(bRegion);
		}
		return aBranch.localeCompare(bBranch);
	});

	sortedAssignments.forEach(assignment => {
		const row = $('<tr>').attr({
			'data-assignment-id': assignment.id,
			'data-region': assignment.regionName,
			'data-branch': assignment.branchName,
			'data-officer': assignment.officerId
		});
		
		// Action cell with remove button
		const actionCell = $('<td>');
		const removeBtn = $('<a>')
			.html('❌')
			.attr('href', '#')
			.addClass('remove-assignment-icon')
			.attr('title', 'Remove this assignment')
			.on('click', function(e) {
				e.preventDefault();
				toggleLOOAssignmentRemoval(assignment);
			});
		actionCell.append(removeBtn);
		
		// Add action cell first
		row.append(actionCell);

		// Add officer and status cells
		const officerCell = $('<td>').text(assignment.officerName);
		const statusCell = $('<td>').addClass('loo-status-cell');
		
		// Determine status based on assignment state
		let statusText = '';
		let statusClass = '';
		
		if (assignment.isNew) {
			// New assignment not yet saved
			statusText = 'Will be saved on Submit';
			statusClass = 'status-pending-add';
		} else {
			// Check if this assignment is marked for deletion
			const pendingRemoval = looAssignmentChanges.find(change => 
				change.action === 'remove' && 
				change.assignmentId === assignment.id
			);
			
			if (pendingRemoval) {
				statusText = 'Will be deleted on Submit';
				statusClass = 'status-pending-delete';
			} else {
				statusText = ''; // Blank for saved status
				statusClass = 'status-saved';
			}
		}
		
		statusCell.text(statusText).addClass(statusClass);
		
		// Add inline styles for better visual feedback
		if (statusClass === 'status-pending-add') {
			statusCell.css({'color': '#28a745', 'font-weight': 'bold'});  // Green for new
		} else if (statusClass === 'status-pending-delete') {
			statusCell.css({'color': '#dc3545', 'font-weight': 'bold'});  // Red for deletion, no strikethrough
			// Apply strikethrough to other cells but not status cell
			row.css({'opacity': '0.6'});
			row.find('td:not(.loo-status-cell)').css({'text-decoration': 'line-through'});
		} else if (statusClass === 'status-saved') {
			// No special styling for saved status (blank)
		}
		
		row.append(officerCell, statusCell);
		tbody.append(row);
	});

	table.append(tbody);
	container.append(table);

	// Update the summary label in the header
	if (typeof updateAssignmentSummaryLabel === 'function') {
		updateAssignmentSummaryLabel();
	}
};

const toggleLOOAssignmentRemoval = (assignment) => {
	if (assignment.isNew) {
		// For newly added assignments (not yet saved), simply remove completely
		dbglog('🔍 STATUS: Removing new LOO assignment completely: ' + assignment.officerName, 'assignment');
		
		// Remove from current assignments display
		const index = window.currentAssignments.findIndex(a => a.id === assignment.id);
		if (index !== -1) {
			window.currentAssignments.splice(index, 1);
		}
		
		// Remove from changes array (find the add change and remove it)
		const changeIndex = looAssignmentChanges.findIndex(change => 
			change.action === 'add' && change.tempAssignment && change.tempAssignment.id === assignment.id
		);
		if (changeIndex !== -1) {
			looAssignmentChanges.splice(changeIndex, 1);
		}
		
		// Refresh display and update indicator
		displayContactAssignments();
		updateChangeIndicator();
		
		// Refresh LOO dropdown to reflect assignment changes
		filterLOODropdown();
		
		// Sync auto-managed roles when assignments change
		if (typeof syncAutoManagedRoles === 'function') {
			syncAutoManagedRoles();
		}
	} else {
		// For existing assignments, check if already marked for deletion
		const existingRemovalIndex = looAssignmentChanges.findIndex(change => 
			change.action === 'remove' && change.assignmentId === assignment.id
		);
		
		if (existingRemovalIndex !== -1) {
			// Already marked for deletion - undo the removal (restore the assignment)
			dbglog('🔍 STATUS: Undoing deletion for LOO: ' + assignment.officerName, 'assignment');
			looAssignmentChanges.splice(existingRemovalIndex, 1);
		} else {
			// Not marked for deletion - mark it for deletion
			dbglog('🔍 STATUS: Marking LOO for deletion: ' + assignment.officerName, 'assignment');
			looAssignmentChanges.push({
				id: `remove-loo-${tempLOORemovalId++}`,
				action: 'remove',
				assignmentId: assignment.id,
				regionName: assignment.regionName,
				branchName: assignment.branchName,
				officerName: assignment.officerName
			});
		}
		
		// Refresh display to update status
		displayContactAssignments();
		updateChangeIndicator();
		
		// Sync auto-managed roles when assignments change
		if (typeof syncAutoManagedRoles === 'function') {
			syncAutoManagedRoles();
		}
	}
};

const handleContactRegionChange = () => {
	const officerSelect = $('#looOfficerSelect');
	const confirmBtn = $('#confirmaddLOOAssignment');
	const selectedRegion = regionSelect.val();
	
	// Clear and disable downstream selects
	branchSelect.find('option:not(:first)').remove();
	branchSelect.prop('selectedIndex', 0);
	branchSelect.prop('disabled', !selectedRegion);
	
	// Reset officer select2 if it exists
	if (officerSelect.hasClass('select2-hidden-accessible')) {
		officerSelect.select2('val', '');
	} else {
		officerSelect.prop('selectedIndex', 0);
	}
	officerSelect.prop('disabled', true);
	confirmBtn.prop('disabled', true);
	
	if (selectedRegion) {
		// Filter branches for selected region
		const filteredBranches = window.regionBranches
			.filter(rb => rb.regionName === selectedRegion)
			.map(rb => rb.branchName);
		
		// Remove duplicates and sort
		const uniqueBranches = [...new Set(filteredBranches)].sort();
		
		// Populate branch dropdown
		uniqueBranches.forEach(branchName => {
			$('<option>', {
				value: branchName,
				text: branchName
			}).appendTo(branchSelect);
		});
	}
};

/// todo8remove why do we even have this handler? there is no longer any branch here, right?
const handleContactBranchChange = () => {
	const branchSelect = $('#contactBranchSelect');
	const officerSelect = $('#looOfficerSelect');
	const confirmBtn = $('#confirmaddLOOAssignment');
	const selectedBranch = branchSelect.val();
	
	officerSelect.prop('disabled', !selectedBranch);
	
	// Reset officer selection and enable if branch is selected
	if (selectedBranch) {
		// Enable the Select2 dropdown
		officerSelect.prop('disabled', false);
		if (officerSelect.hasClass('select2-hidden-accessible')) {
			officerSelect.select2('enable', true);
			officerSelect.select2('val', '');
		}
	} else {
		// Disable and clear the Select2 dropdown
		if (officerSelect.hasClass('select2-hidden-accessible')) {
			officerSelect.select2('val', '');
			officerSelect.select2('enable', false);
		} else {
			officerSelect.prop('selectedIndex', 0);
		}
		officerSelect.prop('disabled', true);
	}	
	confirmBtn.prop('disabled', !selectedBranch);
};

const handleLOOOfficerChange = () => {
	const officerSelect = $('#looOfficerSelect');
	const confirmBtn = $('#confirmaddLOOAssignment');
	let selectedOfficer;
	
	// Handle both Select2 and regular select
	if (officerSelect.hasClass('select2-hidden-accessible')) {
		selectedOfficer = officerSelect.select2('val');
	} else {
		selectedOfficer = officerSelect.val();
	}
	
	confirmBtn.prop('disabled', !selectedOfficer);
};

const addLOOAssignment = () => {
	// Handle both Select2 and regular select
	const officerSelect = $('#looOfficerSelect');
	let officerId;
	if (officerSelect.hasClass('select2-hidden-accessible')) {
		officerId = officerSelect.select2('val');
	} else {
		officerId = officerSelect.val();
	}
	
	// Check if this officer exists in our data
	const selectedOfficer = window.contactFormLoanOfficers.find(o => o.id === officerId);

	// Only validate loan officer selection since branch/region are no longer required
	if (!officerId) {
		alert('Please select a Loan Officer');
		return;
	}

	// Since regions are disabled, we don't need region information for LOO assignments
	// LOO assignments only require the loan officer, no region or branch needed

	// Check if assignment already exists (only need to check officer since no branch/region selection)
	const alreadyExists = window.currentAssignments.some(a => a.officerId === officerId);
	
	if (alreadyExists) {
		alert('This loan officer is already assigned');
		return;
	}
	
	// Check if being removed and this would undo that
	const removalChangeIndex = looAssignmentChanges.findIndex(change => 
		change.action === 'remove' && 
		change.officerId === officerId
	);
	
	if (removalChangeIndex !== -1) {
		// Just undo the removal
		looAssignmentChanges.splice(removalChangeIndex, 1);
		displayContactAssignments();
		return;
	}
	
	// Find officer information
	const officer = window.contactFormLoanOfficers.find(o => o.id === officerId);
	
	if (!officer) {
		alert('Error: Could not find officer information');
		return;
	}
	
	// Create temporary assignment for display
	const tempAssignment = {
		id: `temp-${tempAssignmentId++}`,
		regionName: null, // No region for LOO assignments
		branchName: null, // No branch for LOO assignments
		officerId: officerId,
		officerName: officer.name,
		isNew: true
	};
	
	// Add to current assignments for display
	window.currentAssignments.push(tempAssignment);
	
	// Track the change
	const changeId = `add-${tempAssignment.id}`;
	looAssignmentChanges.push({
		id: changeId,
		action: 'add',
		regionName: null, // No region needed for LOO assignments
		branchName: null, // No branch needed for LOO assignments
		officerId: officerId,
		officerCode: officer.code || '', // NEW: Required for new table
		officerName: officer.name,
		regionId: null, // No region needed for LOO assignments
		branchId: null, // No branch needed for LOO assignments
		tempAssignment: tempAssignment
	});
	
	// Reset officer select but keep it enabled for next assignment
	if (officerSelect.hasClass('select2-hidden-accessible')) {
		officerSelect.select2('val', '__NONE__'); // Reset to placeholder
	} else {
		officerSelect.val('__NONE__'); // Reset to placeholder value
	}

	$('#confirmaddLOOAssignment').prop('disabled', true);
	
	// Refresh display
	displayContactAssignments();
	
	// Refresh LOO dropdown to remove the just-added officer
	filterLOODropdown();
	
	// Sync auto-managed roles when assignments change
	if (typeof syncAutoManagedRoles === 'function') {
		syncAutoManagedRoles();
	}
	
	updateChangeIndicator();
	
};

// Function to filter LOO dropdown to exclude already assigned officers
const filterLOODropdown = () => {
	const $looSelect = $('#looOfficerSelect');
	
	// Only filter if the dropdown exists and is initialized
	if (!$looSelect.length) {
		return;
	}
	
	// Get currently assigned officer IDs
	const assignedOfficerIds = window.currentAssignments ? 
		window.currentAssignments.map(assignment => assignment.officerId) : [];
	
	// If using Select2, handle it appropriately
	if ($looSelect.hasClass('select2-hidden-accessible')) {
		// Get all options
		const allOptions = [];
		$looSelect.find('option').each(function() {
			const value = $(this).val();
			const text = $(this).text();
			
			// Keep placeholder options and unassigned officers
			if (value === '' || value === '__NONE__' || !assignedOfficerIds.includes(value)) {
				allOptions.push({
					id: value,
					text: text
				});
			}
		});
		
		// Clear and repopulate Select2
		$looSelect.select2('destroy');
		$looSelect.empty();
		
		// Re-add filtered options
		allOptions.forEach(option => {
			$looSelect.append(new Option(option.text, option.id));
		});
		
		// Re-initialize Select2
		const container = $('#contact-officer-select-container');
		$looSelect.select2({
			placeholder: "Select loan officer",
			allowClear: false,
			width: '350px',
			dropdownParent: container.length > 0 ? container : $('body'),
			data: allOptions
		});
		
		// Reset to placeholder
		$looSelect.val('__NONE__').trigger('change');
	} else {
		// Handle regular dropdown
		$looSelect.find('option').each(function() {
			const value = $(this).val();
			
			// Hide assigned officers, show unassigned ones
			if (value && value !== '__NONE__' && assignedOfficerIds.includes(value)) {
				$(this).hide();
			} else {
				$(this).show();
			}
		});
		
		// Reset to placeholder
		$looSelect.val('__NONE__');
	}
};

const canceladdLOOAssignment = () => {
	// Hide add controls
	$('#addLOOAssignmentControls').hide();
	$('#addLOOAssignmentLink').show();
	
	// Reset form
	$('#contactRegionSelect').prop('selectedIndex', 0);
	$('#contactBranchSelect').prop('selectedIndex', 0);
	
	const officerSelect = $('#looOfficerSelect');
	if (officerSelect.hasClass('select2-hidden-accessible')) {
		officerSelect.select2('val', '');
		// Keep it enabled since there's no dependency on branch/region anymore
	} else {
		officerSelect.prop('selectedIndex', 0);
	}
	// Don't disable it - keep it ready for use
	//$('#confirmaddLOOAssignment').prop('disabled', true);
};

const saveContactAssignments = async () => {
	if (looAssignmentChanges.length === 0) {
		return;
	}
	

	try {
		const urlParams = new URLSearchParams(window.location.search);
		const contactId = urlParams.get('id');
		
		if (!contactId) {
			throw new Error('No contact ID found in URL');
		}
		
		// Get contact name from form fields for denormalization
		const firstName = $('#firstname').val() || '';
		const lastName = $('#lastname').val() || '';
		const contactName = `${firstName} ${lastName}`.trim();

		// Process each change
		const savePromises = looAssignmentChanges.map(change => {
			if (change.action === 'add') {
				return createLOOAssignment(
					contactId,
					change.officerId,
					change.officerCode,
					change.officerName,
					contactName
				);
			} else if (change.action === 'remove') {
				return deleteContactAssignment(change.assignmentId);
			}
		});
		
		await Promise.all(savePromises);
		
		// Update local data
		looAssignmentChanges.forEach(change => {
			if (change.action === 'remove') {
				// Remove from current assignments
				const index = window.currentAssignments.findIndex(a => a.id === change.assignmentId);
				if (index !== -1) {
					window.currentAssignments.splice(index, 1);
				}
			}
			// For adds, the temp assignment is already in the array with a temp ID
			// In a real implementation, you'd want to update it with the real ID from the server
		});
		
		// Clear changes
		looAssignmentChanges = [];
		
		// Refresh display
		displayContactAssignments();
		
		
	} catch (error) {
		console.error('Error saving assignment changes:', error);
		throw error; // Re-throw so main form save can handle it
	}
};

const saveBranchManagerAssignments = async () => {
	if (branchManagerChanges.length === 0) {
		return;
	}
	
	
	try {
		const urlParams = new URLSearchParams(window.location.search);
		const contactId = urlParams.get('id');
		
		if (!contactId) {
			throw new Error('No contact ID found in URL');
		}
		
		// Get contact name from form fields for denormalization
		const firstName = $('#firstname').val() || '';
		const lastName = $('#lastname').val() || '';
		const contactName = `${firstName} ${lastName}`.trim();

		// Process each change
		const savePromises = branchManagerChanges.map(change => {
			if (change.action === 'add') {
				return createBranchManagerAssignment(
					contactId,
					change.regionId,
					change.branchId,
					change.branchCode,
					change.branchName,
					contactName
				);
			} else if (change.action === 'remove') {
				return deleteBranchManagerAssignment(change.assignmentId);
			}
		});
		
		await Promise.all(savePromises);
		
		// Update local data
		branchManagerChanges.forEach(change => {
			if (change.action === 'remove') {
				// Remove from current assignments
				const index = window.currentBranchManagerAssignments.findIndex(a => a.id === change.assignmentId);
				if (index !== -1) {
					window.currentBranchManagerAssignments.splice(index, 1);
				}
			} else if (change.action === 'add') {
				// Add new assignment to current assignments array
				dbglog('BM Role assign: Adding new BM assignment to window.currentBranchManagerAssignments', 'roles');
				const newAssignment = {
					id: `new-assignment-${Date.now()}`, // Temporary ID since we don't have the real DB ID
					branchName: change.branchName,
					branchId: change.branchId,
					regionName: change.regionName,
					regionId: change.regionId
				};
				window.currentBranchManagerAssignments = window.currentBranchManagerAssignments || [];
				window.currentBranchManagerAssignments.push(newAssignment);
				dbglog('Updated window.currentBranchManagerAssignments = ' + JSON.stringify(window.currentBranchManagerAssignments), 'roles');
			}
		});
		
		// Clear changes
		branchManagerChanges = [];
		
		
	} catch (error) {
		console.error('Error saving BM assignment changes:', error);
		throw error; // Re-throw so main form save can handle it
	}
};

// NEW TABLE: lv_contactbranchassignment
// Fields are TEXT, not lookups - store GUIDs as strings
const createBranchManagerAssignment = async (contactId, regionId, branchId, branchCode, branchName, contactName) => {
	const postBody = {
		"lv_name": `${contactName || 'Contact'} - ${branchName || 'Branch'}`,
		"lv_contact": contactId,
		"lv_contactname": contactName || '',
		"lv_branch": branchId,
		"lv_branchcode": branchCode || '',
		"lv_branchname": branchName || ''
	};

	try {
		const result = await apiCall('lv_contactbranchassignments', 'POST', postBody, true);

		// Check if the API call actually succeeded
		if (result.success === false) {
			throw new Error(`API call failed: ${result.status} ${result.statusText} - ${JSON.stringify(result.data)}`);
		}

		return result;
	} catch (error) {
		console.error('Failed to create BM assignment:', error);
		throw error;
	}
};

// NEW TABLE: lv_contactbranchassignment
const deleteBranchManagerAssignment = async (assignmentId) => {
	const url = `/_api/lv_contactbranchassignments(${assignmentId})`;

	return $.ajax({
		url: url,
		type: 'DELETE',
		headers: {
			'Content-Type': 'application/json',
			'__RequestVerificationToken': CSRF_TOKEN
		}
	}).catch(error => {
		console.error('Failed to delete BM assignment:', error.status, error.statusText, error.responseText || 'No error details');
		throw new Error(`Failed to delete BM assignment: ${error.status} ${error.statusText}`);
	});
};

// Save exclusion changes (add/remove exclusions)
// REFACTORED: Now uses lv_contactloanofficerrelationship table with type=2
const saveExclusionChanges = async () => {
	if (exclusionChanges.length === 0) {
		return;
	}

	// Get contact ID from URL
	const urlParams = new URLSearchParams(window.location.search);
	const contactId = urlParams.get('id');

	if (!contactId) {
		throw new Error('No contact ID found in URL');
	}

	try {
		for (const change of exclusionChanges) {
			if (change.action === 'add') {
				// Add new exclusion using NEW table: lv_contactloanofficerrelationship
				const postBody = {
					"lv_name": `Exclusion - ${change.officerName}`,
					"lv_contact": contactId,
					"lv_loanofficer": change.officerId,
					"lv_loanofficercode": String(change.officerCode || ''),
					"lv_loanofficername": change.officerName,
					"lv_relationshiptype": "X", // 'X' = eXclusion, 'O' = Oversight
					"lv_reason": change.reason || ''
				};

				console.log('📋 Creating exclusion:', postBody);
				const result = await apiCall('lv_contactloanofficerrelationships', 'POST', postBody, false);

				// Check if API call failed
				if (result && result.success === false) {
					throw new Error(`Failed to add exclusion for ${change.officerName}: ${result.statusText || 'Unknown error'}`);
				}

			} else if (change.action === 'remove') {
				// Remove existing exclusion
				console.log('📋 Deleting exclusion:', change.exclusionId);
				const result = await apiCall(`lv_contactloanofficerrelationships(${change.exclusionId})`, 'DELETE', null, true);

				// Check if API call failed
				if (result && result.success === false) {
					throw new Error(`Failed to remove exclusion for ${change.officerName}: ${result.statusText || 'Unknown error'}`);
				}

			} else if (change.action === 'update') {
				// Update existing exclusion reason
				const patchBody = {
					"lv_reason": change.reason || ''
				};

				console.log('📋 Updating exclusion reason:', change.exclusionId, patchBody);
				const result = await apiCall(`lv_contactloanofficerrelationships(${change.exclusionId})`, 'PATCH', patchBody, false);

				// Check if API call failed
				if (result && result.success === false) {
					throw new Error(`Failed to update exclusion reason for ${change.officerName}: ${result.statusText || 'Unknown error'}`);
				}
			}
		}

		// Clear the changes array after successful save
		exclusionChanges = [];

	} catch (error) {
		console.error('❌ Error in saveExclusionChanges:', error);
		// Add more context to the error message
		if (error.message) {
			throw new Error(`Exclusion save failed: ${error.message}`);
		} else {
			throw error;
		}
	}
};

// #region LO Exclusion Management (NEW SIMPLIFIED PER-USER MODEL)
// ============================================================
// REFACTORED: Exclusions are now per-user, not per-branch.
// Uses new table: lv_contactloanofficerrelationship (type=2)
// See docs/ContactAssignment_Refactoring_Plan.md for details
// ============================================================

// Temporary ID counter for new exclusions
let tempExclusionId = 1;

// Display all loan officer exclusions in a table format
// NEW: No longer filters by branch - shows ALL exclusions for this user
const displayLOExclusions = () => {
	const container = $('#loExclusionsList');
	container.empty();

	// Get current exclusions (both saved and pending adds)
	// NEW: No branch filtering - all exclusions are per-user
	const currentExclusions = window.loanOfficerExclusions || [];

	if (currentExclusions.length === 0) {
		container.html('<p style="color: #666; font-style: italic;">No exclusions configured. This user can see all loan officers they have access to.</p>');
		return;
	}

	// Determine if we need to show the Status column
	// Status is shown only when there are pending changes (new items or items marked for removal)
	const hasAnyPendingStatus = currentExclusions.some(excl => excl.isNew) ||
		exclusionChanges.some(change => change.action === 'remove');

	// Create table
	const table = $('<table>').addClass('contact-assignments-table lo-exclusions-table');

	// Table header - SIMPLIFIED: No "Branch" column, Status column only when needed
	const thead = $('<thead>');
	const headerRow = $('<tr>');
	headerRow.append(
		$('<th>').text('Action'),
		$('<th>').text('Loan Officer'),
		$('<th>').text('Code'),
		$('<th>').text('Reason')
	);
	if (hasAnyPendingStatus) {
		headerRow.append($('<th>').text('Status'));
	}
	thead.append(headerRow);
	table.append(thead);

	// Table body
	const tbody = $('<tbody>');

	// Sort by loan officer name
	const sortedExclusions = [...currentExclusions].sort((a, b) => {
		return (a.loanOfficerName || '').localeCompare(b.loanOfficerName || '');
	});

	sortedExclusions.forEach(exclusion => {
		const row = $('<tr>').attr({
			'data-exclusion-id': exclusion.id,
			'data-officer-code': exclusion.loanOfficerCode
		});

		// Action cell with remove button
		const actionCell = $('<td>');
		const removeBtn = $('<a>')
			.html('❌')
			.attr('href', '#')
			.addClass('remove-assignment-icon')
			.attr('title', 'Remove this exclusion')
			.on('click', function(e) {
				e.preventDefault();
				toggleLOExclusionRemoval(exclusion);
			});
		actionCell.append(removeBtn);

		// Loan Officer cell
		const officerCell = $('<td>').text(exclusion.loanOfficerName || '');

		// Code cell (NEW)
		const codeCell = $('<td>').text(exclusion.loanOfficerCode || '');

		// Reason cell (editable for new exclusions)
		const reasonCell = $('<td>');
		if (exclusion.isNew) {
			const reasonInput = $('<input>')
				.attr('type', 'text')
				.addClass('exclusion-reason-inline')
				.val(exclusion.reason || '')
				.attr('placeholder', 'Reason...')
				.on('change', function() {
					exclusion.reason = $(this).val();
					// Update the pending change
					const pendingChange = exclusionChanges.find(c =>
						c.action === 'add' &&
						c.officerCode === exclusion.loanOfficerCode
					);
					if (pendingChange) {
						pendingChange.reason = $(this).val();
					}
				});
			reasonCell.append(reasonInput);
		} else {
			reasonCell.text(exclusion.reason || '');
		}

		// Status cell - only add if we're showing status column
		let statusCell = null;
		let statusClass = '';

		if (hasAnyPendingStatus) {
			statusCell = $('<td>').addClass('exclusion-status-cell');
			let statusText = '';

			if (exclusion.isNew) {
				statusText = 'Will be saved on Submit';
				statusClass = 'status-pending-add';
			} else {
				// Check if marked for deletion
				const pendingRemoval = exclusionChanges.find(change =>
					change.action === 'remove' && change.exclusionId === exclusion.id
				);
				if (pendingRemoval) {
					statusText = 'Will be deleted on Submit';
					statusClass = 'status-pending-delete';
				} else {
					statusText = '';
					statusClass = 'status-saved';
				}
			}

			statusCell.text(statusText).addClass(statusClass);

			// Apply styling based on status
			if (statusClass === 'status-pending-add') {
				statusCell.css({'color': '#28a745', 'font-weight': 'bold'});
			} else if (statusClass === 'status-pending-delete') {
				statusCell.css({'color': '#dc3545', 'font-weight': 'bold'});
			}
		} else {
			// Still need to determine if row should have delete styling
			const pendingRemoval = exclusionChanges.find(change =>
				change.action === 'remove' && change.exclusionId === exclusion.id
			);
			if (pendingRemoval) {
				statusClass = 'status-pending-delete';
			}
		}

		// Apply row-level styling for pending delete
		if (statusClass === 'status-pending-delete') {
			row.css({'opacity': '0.6'});
			row.find('td:not(.exclusion-status-cell)').css({'text-decoration': 'line-through'});
		}

		row.append(actionCell, officerCell, codeCell, reasonCell);
		if (statusCell) {
			row.append(statusCell);
		}
		tbody.append(row);
	});

	table.append(tbody);
	container.append(table);

	// Update the summary label in the header
	if (typeof updateAssignmentSummaryLabel === 'function') {
		updateAssignmentSummaryLabel();
	}
};

// Toggle removal of an exclusion (mark for deletion or undo)
// SIMPLIFIED: No longer tracks branch - just LO code
const toggleLOExclusionRemoval = (exclusion) => {
	if (exclusion.isNew) {
		// For new exclusions: completely remove from list
		window.loanOfficerExclusions = window.loanOfficerExclusions.filter(e =>
			e.id !== exclusion.id
		);

		// Remove from exclusionChanges (match by officer code only now)
		exclusionChanges = exclusionChanges.filter(change =>
			!(change.action === 'add' &&
			  change.officerCode === exclusion.loanOfficerCode)
		);
	} else {
		// For existing exclusions: toggle removal state
		const existingRemovalIndex = exclusionChanges.findIndex(change =>
			change.action === 'remove' && change.exclusionId === exclusion.id
		);

		if (existingRemovalIndex !== -1) {
			// Already marked for removal - undo it
			exclusionChanges.splice(existingRemovalIndex, 1);
		} else {
			// Mark for removal (no branch info needed)
			exclusionChanges.push({
				action: 'remove',
				exclusionId: exclusion.id,
				officerCode: exclusion.loanOfficerCode,
				officerName: exclusion.loanOfficerName
			});
		}
	}

	displayLOExclusions();
	filterExclusionOfficerDropdown();
	updateChangeIndicator();
};

// Add a new exclusion
// SIMPLIFIED: No branch selection - exclusions are per-user
const addLOExclusion = () => {
	// Get selected loan officer (NO BRANCH NEEDED)
	const officerSelect = $('#exclusionOfficerSelect');
	let officerId = officerSelect.hasClass('select2-hidden-accessible')
		? officerSelect.select2('val')
		: officerSelect.val();

	if (!officerId || officerId === '__NONE__' || officerId === '') {
		alert('Please select a loan officer to exclude');
		return;
	}

	// Find the officer in contactFormLoanOfficers
	const officer = (window.contactFormLoanOfficers || []).find(o => o.id === officerId);
	if (!officer) {
		alert('Could not find selected loan officer');
		return;
	}

	// Get officer code from the loan officer record
	const officerCode = officer.code || '';

	// Check if this exclusion already exists (just by officer, no branch)
	const alreadyExists = (window.loanOfficerExclusions || []).some(excl =>
		excl.loanOfficerId === officerId
	);

	if (alreadyExists) {
		alert('This loan officer is already excluded');
		return;
	}

	// Get reason
	const reason = $('#exclusionReasonInput').val() || '';

	// Create temporary exclusion (NO BRANCH)
	const tempExclusion = {
		id: `temp-excl-${tempExclusionId++}`,
		loanOfficerId: officerId,
		loanOfficerCode: officerCode,
		loanOfficerName: officer.name,
		reason: reason,
		relationshipType: 2, // Exclusion
		isNew: true
	};

	// Add to exclusions array
	if (!window.loanOfficerExclusions) {
		window.loanOfficerExclusions = [];
	}
	window.loanOfficerExclusions.push(tempExclusion);

	// Track the change (NO BRANCH INFO)
	exclusionChanges.push({
		action: 'add',
		officerId: officerId,
		officerCode: officerCode,
		officerName: officer.name,
		reason: reason,
		relationshipType: 2 // Exclusion
	});

	// Reset the form
	$('#exclusionReasonInput').val('');
	if (officerSelect.hasClass('select2-hidden-accessible')) {
		officerSelect.select2('val', '__NONE__');
	} else {
		officerSelect.val('').prop('selectedIndex', 0);
	}

	// Refresh display
	displayLOExclusions();
	filterExclusionOfficerDropdown();
	updateChangeIndicator();
};

// Filter the exclusion officer dropdown to exclude already-excluded officers
// SIMPLIFIED: No branch selection - just filter by already excluded
const filterExclusionOfficerDropdown = () => {
	const $officerSelect = $('#exclusionOfficerSelect');

	// Get already excluded officer IDs (all of them, no branch filter)
	const excludedOfficerIds = (window.loanOfficerExclusions || [])
		.map(excl => excl.loanOfficerId);

	// Handle Select2 dropdown
	if ($officerSelect.hasClass('select2-hidden-accessible')) {
		// Clear and rebuild options
		$officerSelect.find('option').each(function() {
			const optionValue = $(this).val();
			if (optionValue && optionValue !== '__NONE__' && optionValue !== '') {
				if (excludedOfficerIds.includes(optionValue)) {
					$(this).prop('disabled', true).hide();
				} else {
					$(this).prop('disabled', false).show();
				}
			}
		});

		// Refresh Select2
		$officerSelect.trigger('change.select2');
	} else {
		// Regular select - hide/show options
		$officerSelect.find('option').each(function() {
			const optionValue = $(this).val();
			if (optionValue && optionValue !== '__NONE__' && optionValue !== '') {
				if (excludedOfficerIds.includes(optionValue)) {
					$(this).hide();
				} else {
					$(this).show();
				}
			}
		});
	}
};

// REMOVED: populateExclusionBranchDropdown - no longer needed
// Exclusions are now per-user, not per-branch

// Initialize LO Exclusion management
// SIMPLIFIED: No branch dropdown needed
const initLOExclusionManagement = () => {
	// Initialize exclusions array if not set
	if (!window.loanOfficerExclusions) {
		window.loanOfficerExclusions = [];
	}

	// Display current exclusions
	displayLOExclusions();

	// Filter the officer dropdown initially
	filterExclusionOfficerDropdown();

	// Setup event handlers
	$('#addLOExclusionLink').on('click', function(e) {
		e.preventDefault();
		$(this).hide();
		$('#addLOExclusionControls').show();

		// Auto-open the loan officer dropdown (no branch needed)
		setTimeout(() => {
			const $officerSelect = $('#exclusionOfficerSelect');
			if ($officerSelect.hasClass('select2-hidden-accessible')) {
				$officerSelect.select2('open');
			} else {
				$officerSelect.focus();
			}
		}, 100);
	});

	// Auto-add when loan officer is selected (no branch check needed)
	$('#exclusionOfficerSelect').on('change', function() {
		const selectedOfficer = $(this).val();

		if (selectedOfficer && selectedOfficer !== '' && selectedOfficer !== '__NONE__') {
			addLOExclusion();
		}
	});
};

// #endregion LO Exclusion Management

// NEW TABLE: lv_contactloanofficerrelationship with relationshiptype = 'O' (Oversight)
// Fields are TEXT, not lookups - store GUIDs as strings
const createLOOAssignment = async (contactId, officerId, officerCode, officerName, contactName) => {
	const postBody = {
		"lv_name": `${contactName || 'Contact'} - ${officerName || 'Officer'} - Oversight`,
		"lv_contact": contactId,
		"lv_contactname": contactName || '',
		"lv_loanofficer": officerId,
		"lv_loanofficercode": officerCode || '',
		"lv_loanofficername": officerName || '',
		"lv_relationshiptype": "O", // 'O' = Oversight
		"lv_reason": '' // No reason for oversight assignments
	};

	try {
		const result = await apiCall('lv_contactloanofficerrelationships', 'POST', postBody, true);

		// Check if the API call actually succeeded
		if (result.success === false) {
			throw new Error(`API call failed: ${result.status} ${result.statusText} - ${JSON.stringify(result.data)}`);
		}

		return result;
	} catch (error) {
		console.error('Failed to create LOO assignment:', error);
		throw error;
	}
};

// NEW TABLE: lv_contactloanofficerrelationship
const deleteContactAssignment = async (assignmentId) => {
	try {
		const result = await apiCall(`lv_contactloanofficerrelationships(${assignmentId})`, 'DELETE', "", true);
		return result;
	} catch (error) {
		console.error('Failed to delete LOO assignment:', error);
		throw error;
	}
};

// Function to update required attribute - NEWAssignTodo8: Simplified since no role-based requirements
const updateRequiredAttribute = (role, isRequired) => {
	// NEWAssignTodo8: No longer needed for assignments, but keeping for other potential uses
	const todo8 = false; // too much headache with real installations like Direct, testing scenarios, etc.
	// This function is now essentially a no-op for assignments
};

// Function to update required fields based on role checkboxes - NEWAssignTodo8: Simplified
const updateRequiredFieldsBasedOnRoles = () => {
	// NEWAssignTodo8: Always set to false regardless of checkboxes since we use assignments now
	updateRequiredAttribute('Loan Officer', false);
	updateRequiredAttribute('Branch Manager', false);
	updateRequiredAttribute('Region Manager', false);
};

{% comment %}   Track whether or not we are in initialization. I now can no longer remember why this is needed, but pretty sure it is  {% endcomment %}  
let isInitializing = true;
	  
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
		$feedback.text('');
		$feedback.hide();
	}, 10000);
};

const detectFormChanges = () => {
	const currentState = captureCompleteFormState();
	const changes = [];
	
	// Get auto-managed role IDs to exclude from change tracking
	const branchRoleId = window.contactFormConfig ? window.contactFormConfig.branchRoleId : '';
	const loanOfficerRoleId = window.contactFormConfig ? window.contactFormConfig.loanOfficerRoleId : '';
	
	// Simple comparison - count all differences
	for (const key in initialFormState) {
		if (initialFormState[key] !== currentState[key]) {
			// Skip auto-managed role checkboxes
			if (key.includes('webroles[]_') && (key.includes(branchRoleId) || key.includes(loanOfficerRoleId))) {
				dbglog('SKIPPING auto-managed role change: ' + key + ', from ' + initialFormState[key] + ' to ' + currentState[key], 'changes');
				continue;
			}
			
			// Skip assignment changes - we'll count these separately
			if (key === '_branchManagerAssignments' || key === '_assignments') {
				dbglog('SKIPPING assignment change (counted separately): ' + key + ', from ' + initialFormState[key] + ' to ' + currentState[key], 'changes');
				continue;
			}
			
			changes.push({
				field: key,
				from: initialFormState[key] || 'None',
				to: currentState[key] || 'None'
			});
			dbglog('DETECTED change: ' + key + ', from ' + initialFormState[key] + ' to ' + currentState[key], 'changes');
		}
	}
	
	// Check for new keys in current state
	for (const key in currentState) {
		if (!(key in initialFormState) && currentState[key]) {
			// Skip auto-managed role checkboxes - check both the key format and the value
			if (key.includes('webroles[]_') && (key.includes(branchRoleId) || key.includes(loanOfficerRoleId))) {
				dbglog('SKIPPING new auto-managed role (key format): ' + key + ', value ' + currentState[key], 'changes');
				continue;
			}
			
			// Also check if this is a webroles[] field with auto-managed role ID as value
			if (key.startsWith('webroles[]') && (currentState[key] === branchRoleId || currentState[key] === loanOfficerRoleId)) {
				dbglog('SKIPPING new auto-managed role (value format): ' + key + ', value ' + currentState[key], 'changes');
				continue;
			}
			
			changes.push({
				field: key,
				from: 'None',
				to: currentState[key]
			});
			dbglog('DETECTED new field: ' + key + ', value ' + currentState[key], 'changes');
		}
	}
	
	// Add assignment changes from operation tracking
	if (typeof branchManagerChanges !== 'undefined') {
		dbglog('branchManagerChanges.length = ' + branchManagerChanges.length, 'changes');
		if (branchManagerChanges.length > 0) {
			branchManagerChanges.forEach(change => {
				changes.push({
					field: `branchManager_${change.action}`,
					from: change.action === 'add' ? 'None' : change.branchName,
					to: change.action === 'add' ? change.branchName : 'None'
				});
			});
			dbglog('ADDED ' + branchManagerChanges.length + ' branch manager changes', 'changes');
		} else {
			dbglog('branchManagerChanges array is empty', 'changes');
		}
	} else {
		dbglog('branchManagerChanges is undefined in detectFormChanges', 'changes');
	}

	// Add exclusion changes from operation tracking
	if (typeof exclusionChanges !== 'undefined' && exclusionChanges.length > 0) {
		exclusionChanges.forEach(change => {
			changes.push({
				field: `exclusion_${change.action}`,
				from: change.action === 'add' ? 'None' : `${change.branchName} - ${change.officerName}`,
				to: change.action === 'add' ? `${change.branchName} - ${change.officerName}` : 'None'
			});
		});
		dbglog('ADDED ' + exclusionChanges.length + ' exclusion changes', 'changes');
	}

	if (typeof looAssignmentChanges !== 'undefined' && looAssignmentChanges.length > 0) {
		looAssignmentChanges.forEach(change => {
			changes.push({
				field: `looAssignment_${change.action}`,
				from: change.action === 'add' ? 'None' : change.officerName,
				to: change.action === 'add' ? change.officerName : 'None'
			});
		});
		dbglog('ADDED ' + looAssignmentChanges.length + ' LOO assignment changes', 'changes');
	}
	
	dbglog('TOTAL CHANGES AFTER FILTERING: ' + changes.length, 'changes');
	return changes;
};

/**
 * Helper function to update a single field via PATCH request
 * @param {string} contactId - The contact ID
 * @param {object} data - The data to patch
 * @returns {Promise} - The ajax promise
 */
const patchContactField = async (contactId, data) => {
	dbglog('=== patchContactField CALLED ===', 'api');
	dbglog('Contact ID: ' + contactId, 'api');
	dbglog('Data to patch: ' + JSON.stringify(data), 'api');
	const url = `contacts(${contactId})`;
	dbglog('API URL: ' + url, 'api');
	
	try {
		dbglog('About to call apiCall...', 'api');
		const result = await apiCall(url, "PATCH", data);
		dbglog('✅ apiCall completed successfully', 'api');
		dbglog('✅ apiCall result: ' + JSON.stringify(result), 'api');
		
		logWrite("ContactUpdate", JSON.stringify(data));
		dbglog('✅ logWrite completed', 'api');
		return result;
	} catch (error) {
		console.error('❌ ERROR in patchContactField:', error);
		console.error('❌ patchContactField error details:', {
			url: url,
			data: data,
			error: error.message,
			stack: error.stack
		});
		throw error;
	}
};
	
/**
 * Helper function to handle lookup field update or clearing - NEWAssignTodo8: Still needed for legacy mode
 * @param {string} contactId - The contact ID
 * @param {string} formFieldName - The form field name (with @odata.bind)
 * @param {string} logicalName - The CRM logical field name (without @odata.bind)
 * @param {string} entityName - The entity type name for binding
 * @param {object} formData - The form data object
 */
const handleLookupField = async (contactId, formFieldName, logicalName, entityName, formData) => {
	if (IsEmpty(formData[formFieldName])) {
		const clearData = { [logicalName]: null };
		await patchContactField(contactId, clearData);
	} else {
		const bindData = { 
			[`${logicalName}@odata.bind`]: `/${entityName}(${formData[formFieldName]})` 
		};
		await patchContactField(contactId, bindData);
	}
};
	
const updateChangeIndicator = () => { // update label showing user the number of edits
	const changes = detectFormChanges();
	
	let $changeIndicator = $('#changeIndicator');
	
	// Create indicator if it doesn't exist
	if (!$changeIndicator.length) {
		const $submitButton = $('#userForm button[type="submit"]');
		$submitButton.after('<div id="changeIndicator" style="display: inline-block; margin-left: 15px; font-size: 14px; vertical-align: middle; color: var(--portalThemeColor11);"></div>');
		$changeIndicator = $('#changeIndicator');
	}

	// Filter out auto-managed fields from display count (but keep them for save logic)
	const autoManagedFields = ['lv_roles']; // Fields that are automatically derived from assignments
	const userVisibleChanges = changes.filter(change => !autoManagedFields.includes(change.field));
	const changeCnt = userVisibleChanges.length;
	
	dbglog('Total changes detected: ' + changes.length, 'changes');
	dbglog('User-visible changes (excluding auto-managed): ' + changeCnt, 'changes');
	
	// Update or hide the indicator
	if (changeCnt > 0) {
		$changeIndicator.text(`${changeCnt} unsaved ${Plural(changeCnt, "change")}`);
		$changeIndicator.show();
	} else {
		$changeIndicator.hide();
	}
};

const addChangeListeners = () => { // Add event listener to update change indicator when form changes
	{% comment %}  // These delays are tricky and I am not certain on how far to push them down.  {% endcomment %} 

	$('#userForm :input').on('change input', debounce(() => {
		updateChangeIndicator();
	}, 250));

	// Special handling for checkboxes with longer delay
	$('input[name="webroles[]"]').on('change', debounce(() => {
		updateChangeIndicator();
	}, 250));

	// Loan officer dropdown - sync auto-managed roles when changed
	$('#lv_LoanOfficerBind').on('change', function() {
		dbglog('LOAN OFFICER CHANGED: ' + $(this).val(), 'changes');
		if (typeof syncAutoManagedRoles === 'function') {
			syncAutoManagedRoles();
		}
		updateChangeIndicator();
	});

	// Legacy branch dropdown - sync auto-managed roles when changed  
	$('select[name="lv_Branch@odata.bind"]').on('change', function() {
		if (typeof syncAutoManagedRoles === 'function') {
			syncAutoManagedRoles();
		}
		updateChangeIndicator();
	});
	
	// Manual Administrators checkbox - update lv_roles when changed
	const branchRoleId = window.contactFormConfig ? window.contactFormConfig.branchRoleId : '';
	const loanOfficerRoleId = window.contactFormConfig ? window.contactFormConfig.loanOfficerRoleId : '';
	
	$('input[name="webroles[]"]').on('change', function() {
		const roleId = $(this).val();
		
		// CRITICAL PROTECTION: Prevent unchecking of Loan Officer role
		if (roleId === loanOfficerRoleId && !$(this).is(':checked')) {
			dbglog('🛡️ UI PROTECTION: Preventing user from unchecking Loan Officer role - ALL CONTACTS MUST HAVE THIS ROLE', 'roles');
			
			// Re-check the checkbox immediately
			$(this).prop('checked', true);
			
			// Show user feedback
			alert('The "Loan Officer" role cannot be removed.\n\nAll contacts must maintain the Loan Officer role for the commission system to function properly.');
			
			return false; // Stop the event
		}
		
		// Only handle manual changes to Administrators (skip auto-managed roles)
		if (roleId !== branchRoleId && roleId !== loanOfficerRoleId) {
			if (typeof updateRolesField === 'function') {
				updateRolesField(); // Update roles field based on current state
			}
		}
	});
};

{% comment %}Note that we have both 'handleSubmit' and 'handleAddSubmit'. At this point I cannot remember why I decided to have two separate, I can only assume that I thought it made life easier{% endcomment %} 
const handleSubmit = debounce(async (e) => {
	console.log('ENTER: handleSubmit');

	if (e && e.preventDefault) {
		e.preventDefault();
		e.stopPropagation();
	}

	const urlParams = new URLSearchParams(window.location.search);
	const contactId = urlParams.get('id'); // Use URL parameter, NOT global variable

	if (!contactId) {
		throw new Error('No contact ID found in URL');
	}

	const todo8 = false;
	if (todo8 && !validateForm()) {
		alert('Please fill in all required fields.');
		return;
	}
	
	// Detect changes
	const changes = detectFormChanges();
	const changeCnt = changes.length;
	dbglog('handleSubmit: changeCnt = ' + changeCnt, 'changes');
	
	// DEBUG: Enhanced change detection logging
	dbglog('=== CHANGE DETECTION DEBUG ===', 'changes');
	dbglog('Changes detected count: ' + changeCnt, 'changes');
	dbglog('Detected changes: ' + JSON.stringify(changes), 'changes');
	if (changes.length === 0) {
		dbglog('No changes detected - form submission will be skipped', 'changes');
	} else {
		dbglog('Changes found - proceeding with form submission', 'changes');
		changes.forEach((change, index) => {
			dbglog('Change ' + (index + 1) + ': ' + change.field + ' changed from "' + change.oldValue + '" to "' + change.newValue + '"', 'changes');
		});
	}
	
	// If no changes, show message and return
	if (changeCnt === 0) {
		dbglog('EARLY RETURN: No changes detected, exiting handleSubmit', 'changes');
		displayFeedbackMessage('Nothing to submit, you did not change anything.');
		return;
	} else {
		dbglog('Changes detected, continuing with handleSubmit', 'changes');
	}
	

	if (branchManagerChanges.length > 0) {
		dbglog('🎯 BRANCH MANAGER CHANGES DETECTED: ' + branchManagerChanges.length + ' changes', 'sync');
		dbglog('🎯 BM CHANGES DETAIL: ' + JSON.stringify(branchManagerChanges), 'sync');
		
		// CRITICAL FIX: Save a copy of branchManagerChanges before saveBranchManagerAssignments clears it
		const branchManagerChangesForRoles = [...branchManagerChanges];
		
		await saveBranchManagerAssignments();
		dbglog('🎯 BRANCH MANAGER ASSIGNMENTS SAVED SUCCESSFULLY', 'sync');
		
		// CRITICAL: Process Branch Manager role changes after assignment updates
		dbglog('🎯 ROLE PROCESSING: Calling Power Automate flow for Branch Manager role changes', 'roles');
		
		// Call Power Automate flow for each Branch Manager assignment change
		const branchManagerRoleId = window.contactFormConfig ? window.contactFormConfig.branchRoleId : '';
		
		if (branchManagerRoleId && branchManagerChangesForRoles && branchManagerChangesForRoles.length > 0) {
			const url = window.urlContactWebRole;
			if (url) {
				for (const change of branchManagerChangesForRoles) {
					const action = change.action; // 'add' or 'remove'
					console.log(`🎯 Calling Power Automate flow: ${action} Branch Manager role for ${change.branchName}`);
					
					const postData = {
						"action": action,
						"contactId": contactId, // This should be the contact being edited, not the logged-in user
						"roleId": branchManagerRoleId
					};
					
					dbglog(`🎯 Branch Manager role ${action}: ` + JSON.stringify(postData), 'roles');
					
					try {
						await apiCall(url, "POST", postData, true);
						dbglog(`✅ Branch Manager role ${action} completed successfully`, 'roles');
					} catch (error) {
						console.error(`❌ ERROR in Branch Manager role ${action}:`, error);
					}
				}
			} else {
				console.error('❌ ERROR: urlContactWebRole not available for Branch Manager role processing');
			}
		}
	}

	// STEP 3: Process loan officer exclusion changes
	if (exclusionChanges.length > 0) {
		try {
			await saveExclusionChanges();
		} catch (error) {
			console.error('❌ CRITICAL ERROR saving exclusion changes:', error);
			hideLoading();
			alert(`Failed to save loan officer exclusion changes:\n\n${error.message || error}\n\nPlease try again or contact support if the problem persists.`);
			throw error; // Re-throw to prevent form submission from continuing
		}
	}

	// Get the form data using jQuery
	const formArray = $('#userForm').serializeArray();
	let formData = {};
	
	// Convert to object
	formArray.forEach(item => {
		formData[item.name] = item.value;
	});
	
	// Debug form data
	dbglog('=== FORM SUBMISSION DEBUG ===', 'submit');
	dbglog('Form data captured: ' + JSON.stringify(formData), 'submit');
	dbglog('lv_roles in formData: ' + formData.lv_roles, 'submit');
	dbglog('Current lv_roles field value: ' + $('#lv_roles').val(), 'submit');
	dbglog('Changes detected: ' + JSON.stringify(changes), 'submit');
	dbglog('Total changes count: ' + changeCnt, 'submit');
	dbglog('Environment info: url=' + window.location.href + ', userAgent=' + navigator.userAgent + ', timestamp=' + new Date().toISOString(), 'submit');

	// 🎯 CRITICAL DEBUG: Check branch manager changes array BEFORE processing
	dbglog('🔍 PRE-PROCESSING CHECK: branchManagerChanges exists? ' + (typeof branchManagerChanges !== 'undefined'), 'submit');
	if (typeof branchManagerChanges !== 'undefined') {
		dbglog('🔍 PRE-PROCESSING CHECK: branchManagerChanges.length = ' + branchManagerChanges.length, 'submit');
		dbglog('🔍 PRE-PROCESSING CHECK: branchManagerChanges content = ' + JSON.stringify(branchManagerChanges), 'submit');
	} else {
		dbglog('❌ PRE-PROCESSING ERROR: branchManagerChanges is undefined!', 'submit');
	}

	// Step 3: Handle the sentinel value conversion for loan officer
	const loanOfficerValue = $('#lv_LoanOfficerBind').val();
	if (loanOfficerValue === '__NONE__') {
		formData['lv_LoanOfficer@odata.bind'] = '';
	} else if (loanOfficerValue) {
		formData['lv_LoanOfficer@odata.bind'] = loanOfficerValue;
	}

	showLoading();

	try {		
		if (looAssignmentChanges.length > 0) {
			await saveContactAssignments();
			
			// CRITICAL: Trigger role synchronization after saving LOO assignments
			// This ensures Loan Officer web role is automatically added when assignments are saved
			dbglog('🔄 TRIGGERING ROLE SYNC after saving LOO assignments', 'sync');
			if (typeof syncAutoManagedRoles === 'function') {
				await new Promise(resolve => {
					// Small delay to ensure database changes are committed
					setTimeout(() => {
						syncAutoManagedRoles(true); // Update roles field too
						dbglog('✅ Role sync completed after LOO assignment save', 'sync');
						resolve();
					}, 500);
				});
			} else {
				console.error('❌ ERROR: syncAutoManagedRoles function not found!');
			}
		}
		
		// First update basic fields
		const basicData = {
			"firstname": formData.firstname,
			"middlename": formData.middlename,
			"lastname": formData.lastname,
			"emailaddress1": formData.emailaddress1
		};
		
		const basicFieldsChanged = ['firstname', 'middlename', 'lastname', 'emailaddress1'].some(fieldName => {
			return changes.some(change => change.field === fieldName);
		});

		if (basicFieldsChanged) {
			await patchContactField(contactId, basicData);
		}
		
		// Check if lookup fields have changed and only update those that have
		const hasFieldChanged = (fieldName) => {
			return changes.some(change => change.field === fieldName);
		};
		
		// Handle lv_roles field if it changed
		if (hasFieldChanged('lv_roles')) {
			dbglog('=== lv_roles FIELD CHANGED - SUBMITTING ===', 'submit');
			dbglog('Submitting lv_roles value: ' + formData.lv_roles, 'submit');
			dbglog('Contact ID: ' + contactId, 'api');
			dbglog('About to call patchContactField for lv_roles...', 'submit');
			const rolesData = {
				"lv_roles": formData.lv_roles
			};
			try {
				await patchContactField(contactId, rolesData);
				dbglog('✅ lv_roles field submitted successfully', 'submit');
				dbglog('✅ patchContactField completed without error', 'submit');
			} catch (error) {
				console.error('❌ ERROR in patchContactField for lv_roles:', error);
				console.error('❌ Error details:', {
					message: error.message,
					stack: error.stack,
					response: error.response
				});
				throw error; // Re-throw to be caught by outer try-catch
			}
		} else {
			dbglog('=== lv_roles FIELD NOT CHANGED - SKIPPING ===', 'submit');
			dbglog('Current lv_roles value: ' + formData.lv_roles, 'submit');
		}
		
		// ALWAYS handle loan officer field (independent of useNew)
		if (hasFieldChanged('lv_LoanOfficer@odata.bind')) {
			await handleLookupField(
				contactId, 
				'lv_LoanOfficer@odata.bind', 
				'lv_LoanOfficer', 
				'lv_lvcomploanofficers', 
				formData
			);
		}
		
		// NOTE: Legacy region/branch field processing removed - now always using new assignment system

		// Process role changes - simple approach using form data
		dbglog('=== WEB ROLE PROCESSING START ===', 'roles');
		const rolePromises = [];
		const url = window.urlContactWebRole;
		dbglog('Web role flow URL: ' + url, 'roles');
		const VERBOSE = true;
		
		if (!url || url.trim() === '') {
			console.error('❌ ERROR: window.urlContactWebRole is not set!');
			alert('WARNING: User role assignment system is not properly configured.\n\nWeb role changes cannot be processed automatically.\n\nPlease contact your system administrator to:\n1. Configure the role assignment URL in system settings\n2. Manually update web roles for this user\n\nForm submission will continue but role changes will not take effect.');
			// Continue with form processing - skip only the web role processing
			dbglog('⚠️ SKIPPING web role processing due to missing URL, continuing with other form operations', 'roles');
		} else {
			// SIMPLIFIED: Only process the actual administrator checkbox
			dbglog('=== ADMINISTRATOR ROLE PROCESSING ===', 'roles');
			
			const adminCheckbox = $('#chkIsSysAdmin');
			if (adminCheckbox.length > 0) {
				const isAdminChecked = adminCheckbox.is(':checked');
				const wasAdminInitiallyChecked = adminCheckbox.data('initially-checked') || false;
				const adminRoleId = window.contactFormConfig ? window.contactFormConfig.adminRoleId : '';
				
				dbglog('🎯 Administrator checkbox found: checked=' + isAdminChecked + ', initially=' + wasAdminInitiallyChecked, 'roles');
				
				if (adminRoleId && (isAdminChecked !== wasAdminInitiallyChecked)) {
					const action = isAdminChecked ? 'add' : 'remove';
					dbglog('🎯 ' + (isAdminChecked ? '➕ ADDING' : '➖ REMOVING') + ' administrator role', 'roles');
					
					const postData = {"action": action, "contactId": contactId, "roleId": adminRoleId};
					dbglog('Admin role POST data: ' + JSON.stringify(postData), 'roles');
					rolePromises.push(apiCall(url, "POST", postData, VERBOSE));
				} else {
					dbglog('⚪ NO CHANGE for administrator role', 'roles');
				}
			} else {
				dbglog('⚠️ Administrator checkbox #chkIsSysAdmin not found on page', 'roles');
			}
			
			// NOTE: Branch Manager roles are processed separately after assignment changes
			dbglog('🎯 Administrator role processing completed. Branch Manager roles handled separately.', 'roles');
			
			// Wait for all role changes to complete
			if (rolePromises.length > 0) {
				dbglog('=== EXECUTING ' + rolePromises.length + ' ROLE CHANGES ===', 'roles');
				try {
					const results = await Promise.all(rolePromises);
					dbglog('✅ All role changes completed successfully', 'roles');
					dbglog('✅ Role change results: ' + JSON.stringify(results), 'roles');
				} catch (error) {
					console.error('❌ ERROR in role changes:', error);
					console.error('❌ Role change error details:', {
						message: error.message,
						stack: error.stack,
						response: error.response
					});
					throw error; // Re-throw to be caught by outer try-catch
				}
			} else {
				dbglog('⚪ NO ROLE CHANGES TO PROCESS', 'roles');
			}
		} // End of web role URL check

		const lastName = $('#lastname').val();
		const firstName = $('#firstname').val();
		writeToLogTable("Profile:Update", `${PAGE_USERNAME} made ${changeCnt} edits to ${firstName} ${lastName}`, "Contact", contactId, "EditorUserId", PAGE_USERID, changes);
		
		// Update initialFormData to reflect the new state
		captureInitialFormData();
		
		// Clear change indicator
		$('#changeIndicator').hide();
		
		// Check if user removed their own admin role (simplified)
		const adminCheckbox = $('#chkIsSysAdmin');
		const wasAdminCheckboxChecked = window.initialAdminCheckboxState || false; // Set during form initialization
		const isNowAdmin = adminCheckbox.length > 0 && adminCheckbox.is(':checked');
		
		if (wasAdminCheckboxChecked && !isNowAdmin) {
			// User removed their own admin role
			alert('Administrator role removed from your account.\n\nNote: Due to Power Pages caching, it may take up to 30 seconds and require multiple page refreshes for the change to fully take effect. You may need to refresh this page several times.');
		}

		// Display success message
		displayFeedbackMessage('Changes saved!');

		// Smart redirect based on user's remaining roles after changes
		setTimeout(() => {
			const redirectUrl = calculateSmartRedirect();
			dbglog('🔄 Smart redirect determined: ' + redirectUrl, 'redirect');
			window.location.href = redirectUrl;
		}, 900);
	} catch (error) {
		console.error('Error submitting form:', error);
		hideLoading();
		alert('Unable to save changes. Please try again or contact support if the problem persists.\n\nError: ' + (error.message || 'Unknown error'));
	} finally {
		hideLoading();
	}
}, 300);

// Smart redirect function - determines where to send user after Contact Form submission
const calculateSmartRedirect = () => {
	dbglog('🧠 calculateSmartRedirect called', 'redirect');
	
	// First priority: use referrer if it's from within our portal
	const referrer = document.referrer;
	dbglog('🧠 Referrer: ' + referrer, 'redirect');
	
	if (referrer && referrer.includes('/Accounting/Profiles')) {
		dbglog('🧠 User came from Profiles - redirecting back to Profiles', 'redirect');
		return '/Accounting/Profiles';
	}
	
	// Check current role checkboxes to determine where user should go
	const hasAdminRole = $('input[name="webroles[]"][value*="admin"]').is(':checked');
	const hasRegionRole = false; 
	const hasBranchRole = $('input[name="webroles[]"][value*="branch"]').is(':checked');
	const hasLoanOfficerRole = $('input[name="webroles[]"][value*="loan"]').is(':checked');
	const hasAssignRole = $('input[name="webroles[]"][value*="assign"]').is(':checked');
	
	dbglog('🧠 Role analysis: admin=' + hasAdminRole + ', region=' + hasRegionRole + ', branch=' + hasBranchRole + ', loanOfficer=' + hasLoanOfficerRole + ', assign=' + hasAssignRole, 'redirect');
	
	// Admin or Role Assign users can access Profiles
	if (hasAdminRole || hasAssignRole) {
		dbglog('🧠 User has admin/assign role - redirecting to Profiles', 'redirect');
		return '/Accounting/Profiles';
	}
	
	
	// Branch managers go to Branch page
	if (hasBranchRole) {
		dbglog('🧠 User has branch role - redirecting to Branch', 'redirect');
		return '/Branch';
	}
	
	// Loan officers go to Loan Officer page
	if (hasLoanOfficerRole) {
		dbglog('🧠 User has loan officer role - redirecting to Loan Officer', 'redirect');
		return '/Loan-Officer';
	}
	
	// Fallback to home page if no recognized roles
	dbglog('🧠 No recognized roles - redirecting to home', 'redirect');
	return '/';
};

const sortSelectOptionsByName = (selector) => { // Sorting and initialization
	const $select = $(selector);
	if (!$select.length) return;
	
	const firstOption = $select.find('option:first')[0].outerHTML;
	const optionsArray = $.makeArray($select.find('option:not(:first)'));
	
	optionsArray.sort((a, b) => $(a).text().localeCompare($(b).text()));

	$select.html(firstOption + optionsArray.map(option => option.outerHTML).join(''));
};

const debugChangeCount = () => {
	
	// Get current form values
	const currentValues = {};
	$('#userForm :input').not('[name="webroles[]"]').each(function() {
		if ($(this).attr('name')) {
			currentValues[$(this).attr('name')] = $(this).val().trim();
		}
	});
	
	// Detect differences
	for (const key in currentValues) {
		if (initialFormData[key] !== currentValues[key]) {
		}
	}
	
	// Check the changes array
	const changes = detectFormChanges();
	
	// NEWAssignTodo8: Debug assignment changes
};

const initForm = () => {

	$('#userForm').off('submit');
	isInitializing = true;
	
	// Debug initial lv_roles field value
	dbglog('=== INITIAL FORM STATE DEBUG ===', 'init');
	const initialRolesValue = $('#lv_roles').val();
	dbglog('Initial lv_roles field value: "' + initialRolesValue + '"', 'init');
	
	// Debug initial role checkboxes and capture admin state
	dbglog('=== INITIAL ROLE CHECKBOXES ===', 'init');
	$('input[name="webroles[]"]').each(function() {
		const roleId = $(this).val();
		const isChecked = $(this).is(':checked');
		dbglog('Initial checkbox - ID: ' + roleId + ', Checked: ' + isChecked, 'init');
		
		// Capture initial admin checkbox state for later comparison
		if (roleId.toLowerCase().includes('admin')) {
			window.initialAdminCheckboxState = isChecked;
			dbglog('🔍 Captured initial admin checkbox state: ' + isChecked, 'init');
		}
	});

	// Edit mode only - set up form submission handling
	$('#userForm button[type="submit"]').off('click').on('click', function(e) {
		e.preventDefault();
		e.stopPropagation();
		
		// Immediate visual feedback - disable button and show spinner
		const $submitButton = $(this);
		const originalText = $submitButton.text();
		$submitButton.prop('disabled', true);
		$submitButton.html('<span class="submit-spinner"></span> Saving...');
		
		// Call the actual submit handler
		handleSubmit(e).finally(() => {
			// Note: Button will be re-enabled in hideLoading() or on error
			// If there's an error, restore the button
			if ($submitButton.prop('disabled')) {
				$submitButton.prop('disabled', false).text(originalText);
			}
		});
	});

	// Set focus to First Name field
	setTimeout(() => {
		const firstNameField = $('#firstname');
		if (firstNameField.length) {
			firstNameField.focus();
			dbglog('Focus set to First Name field', 'init');
		}
	}, 100);

	// Delay adding change listeners until after initial data capture
	setTimeout(function() {
		dbglog('=== CAPTURING INITIAL STATE BEFORE CORRECTIONS ===', 'init');
		captureInitialFormData(); // Capture ACTUAL database state BEFORE any corrections
		
		
		dbglog('=== INITIALIZING lv_roles FIELD ===', 'init');
		// Initialize lv_roles field to match current assignments AFTER capturing initial data
		dbglog('=== INITIAL ROLE SYNCHRONIZATION DEBUG ===', 'init');
		dbglog('About to call updateRolesField()...', 'init');
		if (typeof updateRolesField === 'function') {
			updateRolesField();
		} else {
			console.error('❌ ERROR: updateRolesField function not found!');
		}
		
		// CRITICAL: Also fix the checkboxes to match assignments so they're in sync
		dbglog('About to call syncAutoManagedRoles()...', 'init');
		if (typeof syncAutoManagedRoles === 'function') {
			dbglog('=== SYNCING AUTO-MANAGED ROLE CHECKBOXES ===', 'init');
			syncAutoManagedRoles(false); // Don't trigger change events during sync
		} else {
			console.error('❌ ERROR: syncAutoManagedRoles function not found!');
		}
		
		addChangeListeners(); // Add listeners AFTER initial capture and corrections
		updateChangeIndicator(); // This will now correctly show changes if corrections were made
	}, 2000);
	
	isInitializing = false;
	updateRequiredFieldsBasedOnRoles();
	
	// NOTE: Legacy dropdown sorting removed - now always using new assignment system

	// Allow admin role editing for: Admins, Role Assign users, or users with backdoor access
	const canEditAdminRoles = G_Roles.isAdmin || G_Roles.isAssign || (window.DEBUG_AdminVars && window.DEBUG_AdminVars.has_admin_backdoor);
	
	if (canEditAdminRoles) {
		// User can edit admin roles - keep admin section enabled
	} else {
		// User cannot edit admin roles - disable admin section
		$("div.admin-role").css({"pointer-events": "none", "opacity": "0.6"});
		$("div.admin-role input, div.admin-role select, div.admin-role textarea, div.admin-role button").prop("disabled", true);
	}


	// Capture initial checkbox states for all role checkboxes (visible and hidden)
	setTimeout(function() {
		dbglog('Checkbox initialization setTimeout executing at ' + new Date().toISOString(), 'deploy');
		$('input[name="webroles[]"]').each(function() {
			// CRITICAL FIX: Only set initially-checked if it hasn't been set already by setRoleCheckbox()
			// This prevents overwriting the correct value set by the Contact-Form initialization
			const currentDataValue = $(this).data('initially-checked');
			if (currentDataValue === undefined) {
				$(this).data('initially-checked', $(this).is(':checked'));
			}
		});
	}, 100); // Small delay to ensure auto-role checkboxes are created

	// Always initialize assignment management (new system only)
	initAssignmentManagement();

	// todo8: What is this section ? Debug button binding
	setTimeout(() => {
		const addBtn = $('#confirmaddLOOAssignment');
		
		const events = $._data(addBtn[0], "events");
		
		// Test manual click
		addBtn.on('click.test', function(e) {
			e.preventDefault();
		});
	}, 3000); // Wait for everything to initialize

	const addBtn = $('#confirmaddLOOAssignment');

	spinShow(false);
};

// NEWAssignTodo8: Initialize assignment management functionality
const initAssignmentManagement = () => {
	// Initialize loan officer assignments if not already set
	if (!window.currentAssignments) {
		window.currentAssignments = [];
	}

	const cfgRegionEnabled = typeof window.cfgRegionEnabled !== 'undefined' ? window.cfgRegionEnabled : true;

	// Display current assignments
	displayContactAssignments();
	
	// Filter LOO dropdown to exclude already assigned officers during initialization
	filterLOODropdown();
	
	// Setup event handlers for assignment controls
	$('#addLOOAssignmentLink').on('click', function(e) {
		e.preventDefault();
		$(this).hide();
		$('#addLOOAssignmentControls').show();
		
		// Auto-open the loan officer dropdown for better UX
		setTimeout(() => {
			const officerSelect = document.getElementById('looOfficerSelect');
			
			if (officerSelect && !officerSelect.disabled) {
				
				// Handle Select2 dropdown
				if ($(officerSelect).hasClass('select2-hidden-accessible')) {
					$(officerSelect).select2('open');
				} else {
					// Handle regular select
					officerSelect.focus();
					officerSelect.click();
					
					// Alternative method for some browsers
					if (officerSelect.size <= 1) {
						officerSelect.size = Math.min(officerSelect.options.length, 10);
						
						// Reset to normal dropdown when user makes a selection
						const resetDropdown = () => {
							officerSelect.size = 1;
							officerSelect.removeEventListener('change', resetDropdown);
						};
						officerSelect.addEventListener('change', resetDropdown);
					}
				}
				
			} else {
			}
		}, 100); // Small delay to ensure controls are fully displayed
	});	

	// Auto-add loan officer assignment on dropdown selection
	$('#looOfficerSelect').on('change', function() {
		const selectedOfficer = $(this).val();
		
		if (selectedOfficer && selectedOfficer !== '' && selectedOfficer !== '__NONE__') {
			dbglog('🔍 AUTO-ADD: Loan officer selected: ' + selectedOfficer, 'assignment');
			
			// Add the assignment
			addLOOAssignment();
			
			// Reset dropdown to prompt (keep controls visible for next assignment)
			if ($(this).hasClass('select2-hidden-accessible')) {
				$(this).select2('val', '__NONE__');
			} else {
				$(this).val('__NONE__').prop('selectedIndex', 0);
			}
			
			// Refresh the loan officer dropdown to exclude newly assigned officer
			if (typeof filterLOODropdown === 'function') {
				filterLOODropdown();
			}
			
			dbglog('🔍 AUTO-ADD: Loan officer assignment added, dropdown reset and ready for next assignment', 'assignment');
		}
	});

	// Add change listeners for assignment changes to update main change indicator
	const originalUpdateChangeIndicator = updateChangeIndicator;
	window.updateChangeIndicator = () => {
		originalUpdateChangeIndicator();
		// This ensures assignment changes are reflected in the main change indicator
	};

	initBranchManagerManagement();
	initLOExclusionManagement();
};

document.addEventListener("LVGlobalDOCReady", initForm);

// Last modified Mon 29 2509291413

<!-- Last modified Mon Sep 29 3:06PM -->
<!-- Last modified Wed Oct 29 7:59AM -->
<!-- Last modified Wed Oct 29 4:51PM -->
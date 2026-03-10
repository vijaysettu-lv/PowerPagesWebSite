<!-- Last modified Fri Oct 31 8:04AM -->
// LVGlobal.js - Global utility functions for CommPortal2
// This file is loaded in Footer template and available site-wide
// MIGRATED FROM FOOTER: String prototypes, date utilities, and pure helper functions

console.log("LVGlobal.js loaded successfully at", new Date().toISOString());

// #region String Prototype Extensions
// These extend the String object with useful utility methods

String.prototype.After = function(str) {
	const index = this.indexOf(str);
	if (index === -1) {
		return "";
	}
	return this.substring(index + str.length);
};

String.prototype.BeginsWith = function(searchString, ignoreCase = false) {
	if (searchString === null || searchString === undefined) return false;

	if (ignoreCase) {
		return this.substring(0, searchString.length).toLowerCase() ===
			   searchString.toLowerCase();
	} else {
		return this.substring(0, searchString.length) === searchString;
	}
};

String.prototype.Has = function(s2) {
	return this.toLowerCase().includes(s2.toLowerCase());
};

String.prototype.Is = function(s2) {
	const thisStr = this.trim().toLowerCase();
	const otherStr = (s2 === null || s2 === undefined) ? "" : s2.trim().toLowerCase();
	return thisStr === otherStr;
};

String.prototype.IsNot = function(s2) {
	return !this.Is(s2);
};

String.prototype.IsEmpty = function() {
	return this === null || this === undefined || this.trim() === '';
};

String.prototype.HasValue = function() {
	return !this.IsEmpty();
};

// #endregion String Prototype Extensions

// #region Date and Time Utilities

/**
 * Converts UTC date string to local formatted string
 * @param {string} utcDateString - UTC date string from API
 * @returns {string} - Formatted like "Mon 15 Jan 9:30am"
 */
function DateUtcToLocalString(utcDateString) {
	const date = new Date(utcDateString);

	const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
	const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

	const day = dayNames[date.getDay()];
	const dayOfMonth = date.getDate();
	const month = monthNames[date.getMonth()];

	let hours = date.getHours();
	const ampm = hours >= 12 ? 'pm' : 'am';
	hours = hours % 12;
	hours = hours ? hours : 12; // Convert 0 to 12

	const minutes = date.getMinutes().toString().padStart(2, '0');

	return `${day} ${dayOfMonth} ${month} ${hours}:${minutes}${ampm}`;
}

/**
 * Returns a relative time description at the day level for a target date compared to a reference date
 * @param {string|Date} targetDate - The date to compare
 * @param {string|Date|null} referenceDate - The reference date (defaults to current time)
 * @returns {string} - "today", "yesterday", or "X days ago"
 */
function daysAgo(targetDate, referenceDate = null) {
	const target = new Date(targetDate);
	const reference = referenceDate ? new Date(referenceDate) : new Date();

	// Reset hours to compare dates only (not time)
	const targetDay = new Date(target.getFullYear(), target.getMonth(), target.getDate());
	const referenceDay = new Date(reference.getFullYear(), reference.getMonth(), reference.getDate());

	// Calculate the difference in milliseconds
	const diffMs = referenceDay - targetDay;
	const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

	if (diffDays === 0) {
		return "today";
	} else if (diffDays === 1) {
		return "yesterday";
	} else if (diffDays > 1) {
		return `${diffDays} days ago`;
	} else {
		// Future date
		return "today";
	}
}

/**
 * Enhanced date formatting for approval messages
 * @param {string} utcDateString - UTC date string from API
 * @returns {string} - Formatted message like "Wed Jun 25 2025 at 9:42am (today)"
 */
function formatApprovalDate(utcDateString) {
	const date = new Date(utcDateString);

	const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
	const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

	// Time formatting
	let hours = date.getHours();
	const ampm = hours >= 12 ? 'pm' : 'am';
	hours = hours % 12;
	hours = hours ? hours : 12; // Convert 0 to 12
	const minutes = date.getMinutes().toString().padStart(2, '0');

	// Date formatting
	const day = dayNames[date.getDay()];
	const month = monthNames[date.getMonth()];
	const dayOfMonth = date.getDate();
	const year = date.getFullYear();

	// Relative date
	const relativeDate = daysAgo(utcDateString);

	return `${day} ${month} ${dayOfMonth} ${year} at ${hours}:${minutes}${ampm} (${relativeDate})`;
}

/**
 * Create personalized approval message based on viewer and approver
 * @param {string} approverName - Name of person who made approval
 * @param {string} approverEmail - Email of person who made approval
 * @param {string} currentUserEmail - Email of current viewer
 * @param {string} utcDateString - UTC date string from API
 * @returns {string} - Personalized message
 */
function formatPersonalizedApprovalMessage(approverName, approverEmail, currentUserEmail, utcDateString) {
	const formattedDate = formatApprovalDate(utcDateString);

	// Check if the viewer is the same person who made the approval
	const isViewerTheApprover = approverEmail && currentUserEmail &&
							   approverEmail.toLowerCase() === currentUserEmail.toLowerCase();

	if (isViewerTheApprover) {
		return `You approved these commissions on ${formattedDate}`;
	} else {
		return `Approved by ${approverName} on ${formattedDate}`;
	}
}

// #endregion Date and Time Utilities

// #region URL and Path Utilities

/**
 * Normalizes a URL to full format for API calls
 * @param {string} url - Partial or full URL
 * @returns {string} - Full normalized URL
 */
function normalizeUrl(url) {
	const baseUrl = window.location.origin;
	let fullUrl = "";

	// Case 1: Full URL already provided
	if (url.startsWith('http')) {
		fullUrl = url;
	} else if (url.startsWith('/_api')) {
		fullUrl = baseUrl + url;
	} else if (url.startsWith('_api/')) {
		fullUrl = baseUrl + '/' + url;
	} else if (url.startsWith('/')) {
		fullUrl = baseUrl + '/_api' + url;
	} else {
		fullUrl = baseUrl + '/_api/' + url;
	}

	return fullUrl;
}

/**
 * Extracts the first path segment from a URL
 * @param {string} [url] - Optional URL to parse (defaults to current window.location)
 * @returns {string} The first path segment, or empty string if none exists
 */
function getFirstPathSegment(url) {
	try {
		const urlToUse = url || window.location.pathname;
		const segments = urlToUse.split('/').filter(segment => segment.length > 0);
		return segments.length > 0 ? segments[0] : '';
	} catch (error) {
		console.error('Error getting first path segment:', error);
		return '';
	}
}

// #endregion URL and Path Utilities

// #region General Utilities

/**
 * Checks if a value has meaningful content
 * Null, undefined, empty strings, empty arrays, and empty objects are NOT
 * considered to 'have a value'. Perhaps a better name would be isMeaningful?
 * @param {any} anything - The value to check
 * @returns {boolean} - True if the value is meaningful, false otherwise
 */
function HasValue(anything) {
	// Check for null or undefined
	if (anything == null) {
		return false;
	}

	// For strings, check if it's empty or just whitespace
	if (typeof anything === 'string') {
		return anything.trim() !== '';
	}

	// For arrays, check if it has any elements
	if (Array.isArray(anything)) {
		return anything.length > 0;
	}

	// For objects, check if it has any own enumerable properties
	if (typeof anything === 'object') {
		return Object.keys(anything).length > 0;
	}

	// For numbers, booleans, etc., they have value if they exist
	return true;
}

/**
 * Inverse of HasValue - checks if value is empty/meaningless
 * @param {any} anything - The value to check
 * @returns {boolean} - True if empty/meaningless
 */
function IsEmpty(anything) {
	return !HasValue(anything);
}

/**
 * Utility function for pluralization
 * @param {number} n - The count
 * @param {string} singular - The singular form
 * @param {string} plural - The plural form (optional, defaults to singular + 's')
 * @returns {string} - Pluralized string based on count
 */
function Plural(n, singular, plural) {
	if (plural === undefined) {
		plural = singular + 's';
	}
	return n === 1 ? singular : plural;
}

// #endregion General Utilities

console.log("LVGlobal.js migration complete - String prototypes, date utilities, and helper functions loaded");

<!-- Last modified Fri Oct 31 8:04AM -->
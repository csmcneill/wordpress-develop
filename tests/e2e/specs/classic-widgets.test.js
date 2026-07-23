/**
 * WordPress dependencies
 */
import { test, expect } from '@wordpress/e2e-test-utils-playwright';

/** REST route for the Classic Widgets plugin. */
const CLASSIC_WIDGETS_PLUGIN = '/wp/v2/plugins/classic-widgets/classic-widgets';

/**
 * The classic widgets admin screen (widgets.php with the block-based editor
 * disabled). Uses the Classic Widgets plugin, installed via the REST API,
 * and the screen's accessibility mode (forced via the widgets-access query
 * argument), which exposes deterministic Add/Edit links instead of
 * drag-and-drop.
 *
 * Relies on Twenty Twenty-One being the active theme, which registers a
 * single "Footer" widget area (sidebar-1).
 */
test.describe( 'Classic Widgets', () => {
	test.beforeAll( async ( { requestUtils } ) => {
		// Install and activate the Classic Widgets plugin if needed.
		try {
			await requestUtils.rest( {
				method: 'POST',
				path: '/wp/v2/plugins',
				data: { slug: 'classic-widgets', status: 'active' },
			} );
		} catch {
			// Already installed: activate it instead.
			await requestUtils.rest( {
				method: 'PUT',
				path: CLASSIC_WIDGETS_PLUGIN,
				data: { status: 'active' },
			} );
		}
	} );

	test.afterAll( async ( { requestUtils } ) => {
		await requestUtils.rest( {
			method: 'PUT',
			path: CLASSIC_WIDGETS_PLUGIN,
			data: { status: 'inactive' },
		} );
	} );

	test.beforeEach( async ( { requestUtils } ) => {
		await requestUtils.deleteAllWidgets();
	} );

	/**
	 * Ensures the widgets screen is in accessibility mode. The mode is a
	 * persisted user setting toggled by a nonced link, so the screen may
	 * load in either state.
	 *
	 * @param {import('@playwright/test').Page} page The Playwright page, already on widgets.php.
	 * @return {Promise<void>}
	 */
	async function enableAccessibilityMode( page ) {
		const enableLink = page.getByRole( 'link', {
			name: 'Enable accessibility mode',
		} );
		if ( await enableLink.isVisible() ) {
			await enableLink.click();
		}
	}

	test( 'adds a widget to a sidebar in accessibility mode', async ( {
		admin,
		page,
	} ) => {
		await admin.visitAdminPage( '/widgets.php' );
		await enableAccessibilityMode( page );

		// Add the Search widget.
		await page
			.locator( '#widget-list .widget', { hasText: 'Search' } )
			.getByRole( 'link', { name: 'Add' } )
			.first()
			.click();

		// The widget form targets the theme's only sidebar; save it.
		await page.getByRole( 'button', { name: 'Save Widget' } ).click();

		// The widget appears in the sidebar's widget list.
		await expect(
			page
				.locator( '#sidebar-1' )
				.locator( '.widget', { hasText: 'Search' } )
		).toBeVisible();

		// The search form renders on the front end.
		await page.goto( '/' );
		await expect(
			page.getByRole( 'searchbox', { name: 'Search' } )
		).toBeVisible();
	} );

	test( 'removes a widget from a sidebar in accessibility mode', async ( {
		admin,
		page,
	} ) => {
		await admin.visitAdminPage( '/widgets.php' );
		await enableAccessibilityMode( page );

		// Add the widget through the UI, then remove it the same way.
		await page
			.locator( '#widget-list .widget', { hasText: 'Search' } )
			.getByRole( 'link', { name: 'Add' } )
			.first()
			.click();
		await page.getByRole( 'button', { name: 'Save Widget' } ).click();
		await expect(
			page
				.locator( '#sidebar-1' )
				.locator( '.widget', { hasText: 'Search' } )
		).toBeVisible();

		// Edit the widget in the sidebar, then delete it.
		await page
			.locator( '#sidebar-1' )
			.locator( '.widget', { hasText: 'Search' } )
			.getByRole( 'link', { name: 'Edit' } )
			.click();
		await page.getByRole( 'button', { name: 'Delete' } ).click();

		// The sidebar no longer lists the widget.
		await expect(
			page
				.locator( '#sidebar-1' )
				.locator( '.widget', { hasText: 'Search' } )
		).toBeHidden();

		// The search form is gone from the front end.
		await page.goto( '/' );
		await expect(
			page.getByRole( 'searchbox', { name: 'Search' } )
		).toBeHidden();
	} );
} );

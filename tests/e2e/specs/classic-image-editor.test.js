/**
 * External dependencies
 */
import path from 'node:path';

/**
 * WordPress dependencies
 */
import { test, expect } from '@wordpress/e2e-test-utils-playwright';

/** A 400×300 gradient PNG generated for these tests. */
const TEST_IMAGE_PATH = path.join(
	__dirname,
	'../assets/test-image-400x300.png'
);

/**
 * Reads an attachment's stored dimensions via the REST API.
 *
 * @param {import('@wordpress/e2e-test-utils-playwright').RequestUtils} requestUtils The request utils fixture.
 * @param {number}                                                      mediaId      The attachment ID.
 * @return {Promise<{width: number, height: number}>} Stored dimensions.
 */
async function getImageDimensions( requestUtils, mediaId ) {
	const media = await requestUtils.rest( {
		path: `/wp/v2/media/${ mediaId }`,
		params: { context: 'edit' },
	} );
	return {
		width: media.media_details.width,
		height: media.media_details.height,
	};
}

/**
 * The classic image editor (crop, rotate, scale) on the attachment edit
 * screen — the wp-image-editor UI, as distinct from uploading and from the
 * block editor's media editing.
 */
test.describe( 'Classic Image Editor', () => {
	test.beforeEach( async ( { requestUtils } ) => {
		await requestUtils.deleteAllMedia();
	} );

	test( 'scales an image to a new width', async ( {
		admin,
		page,
		requestUtils,
	} ) => {
		const media = await requestUtils.uploadMedia( TEST_IMAGE_PATH );

		await admin.visitAdminPage(
			'/post.php',
			`post=${ media.id }&action=edit`
		);
		await page.getByRole( 'button', { name: 'Edit Image' } ).click();

		// Open the scale panel and set a new width. The height field syncs
		// to preserve the aspect ratio.
		await page.getByRole( 'button', { name: 'Scale' } ).click();
		const dimensions = page.getByRole( 'group', {
			name: 'New dimensions:',
		} );
		await expect( dimensions ).toBeVisible();
		await dimensions.getByRole( 'spinbutton' ).first().fill( '200' );
		await dimensions.getByRole( 'button', { name: 'Scale' } ).click();

		await expect
			.poll(
				async () =>
					( await getImageDimensions( requestUtils, media.id ) )
						.width,
				{ message: 'the stored image should be scaled to 200px' }
			)
			.toBe( 200 );
	} );

	test( 'rotates an image and saves the edit', async ( {
		admin,
		page,
		requestUtils,
	} ) => {
		const media = await requestUtils.uploadMedia( TEST_IMAGE_PATH );

		await admin.visitAdminPage(
			'/post.php',
			`post=${ media.id }&action=edit`
		);
		await page.getByRole( 'button', { name: 'Edit Image' } ).click();

		// Rotate 90° via the rotation menu and persist the edit.
		await page.getByRole( 'button', { name: 'Image Rotation' } ).click();
		await page.getByRole( 'button', { name: 'Rotate 90° left' } ).click();
		await page.getByRole( 'button', { name: 'Save Edits' } ).click();

		// A 400×300 image rotated 90° stores as 300×400.
		await expect
			.poll( async () => getImageDimensions( requestUtils, media.id ), {
				message: 'the stored dimensions should be swapped',
			} )
			.toEqual( { width: 300, height: 400 } );
	} );
} );

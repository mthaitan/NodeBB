import db from '../database';
import plugins from '../plugins';

import { PostObject } from '../types';
import { getPostFields, setPostField } from './data';

export default function (Posts:PostObject) {
    async function hasBeenBookmarked(pid:number[] | number, uid:string):Promise<false|boolean[]> {
        if (parseInt(uid, 10) <= 0) {
            return Array.isArray(pid) ? pid.map(() => false) : false;
        }

        if (Array.isArray(pid)) {
            const sets = pid.map(pid => `pid:${pid}:users_bookmarked`);
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            return await db.isMemberOfSets(sets, uid);
        }
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        return await db.isSetMember(`pid:${pid}:users_bookmarked`, uid);
    }

    async function toggleBookmark(type:string, pid:number, uid:string)
        :Promise<{post: PostObject; isBookmarked: boolean;}> {
        if (parseInt(uid, 10) <= 0) {
            throw new Error('[[error:not-logged-in]]');
        }

        const isBookmarking = type === 'bookmark';

        const hasBookmarked:Promise<false|boolean[]> = hasBeenBookmarked(pid, uid);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        const postData:PostObject = getPostFields(pid, ['pid', 'uid']);

        if (isBookmarking && hasBookmarked) {
            throw new Error('[[error:already-bookmarked]]');
        }

        if (!isBookmarking && !hasBookmarked) {
            throw new Error('[[error:already-unbookmarked]]');
        }

        if (isBookmarking) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            await db.sortedSetAdd(`uid:${uid}:bookmarks`, Date.now(), pid);
        } else {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            await db.sortedSetRemove(`uid:${uid}:bookmarks`, pid);
        }
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        await db[isBookmarking ? 'setAdd' : 'setRemove'](`pid:${pid}:users_bookmarked`, uid);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        postData.bookmarks = await db.setCount(`pid:${pid}:users_bookmarked`);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        await setPostField(pid, 'bookmarks', postData.bookmarks);

        plugins.hooks.fire(`action:post.${type}`, {
            pid: pid,
            uid: uid,
            owner: postData.uid,
            current: hasBookmarked ? 'bookmarked' : 'unbookmarked',
        });

        return {
            post: postData,
            isBookmarked: isBookmarking,
        };
    }

    async function bookmark(pid:number, uid:string):Promise<{ post:PostObject; isBookmarked:boolean; }> {
        return await toggleBookmark('bookmark', pid, uid);
    }

    async function unbookmark(pid:number, uid:string):Promise<{ post: PostObject; isBookmarked: boolean; }> {
        return await toggleBookmark('unbookmark', pid, uid);
    }
}

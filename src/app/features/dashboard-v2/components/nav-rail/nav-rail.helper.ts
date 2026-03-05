export type DocLink = { label: string; href: string };

function roleIncludes(roleRaw: string | null | undefined, token: string): boolean {
    return (roleRaw ?? '').toLowerCase().includes(token.toLowerCase());
}

export function getDocumentationLinkForRole(roleRaw: string | null | undefined): DocLink {
    const role = (roleRaw ?? '').toLowerCase();

    if (role.includes('requirements')) {
        return { label: 'Requirements', href: '/assets/docs/requirements.pdf' };
    }

    if (role.includes('contracting')) {
        return { label: 'Contracting Documentation', href: '/assets/docs/contracting.pdf' };
    }

    if (role.includes('coordinator')) {
        return { label: 'Coordinator Documentation', href: '/assets/docs/coordinator.pdf' };
    }

    // Default: Admin / CO / etc.
    return { label: 'Admin Documentation', href: '/assets/docs/admin.pdf' };
}

export function canSeeNewRequest(roleRaw: string | null | undefined): boolean {
    return (
        roleIncludes(roleRaw, 'requirements') ||
        roleIncludes(roleRaw, 'admin') ||
        roleIncludes(roleRaw, 'super admin')
    );
}

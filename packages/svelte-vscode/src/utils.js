export function atob(encoded) {
    const buffer = Buffer.from(encoded, 'base64');
    return buffer.toString('utf8');
}

export function btoa(decoded) {
    const buffer = Buffer.from(decoded, 'utf8');
    return buffer.toString('base64');
}

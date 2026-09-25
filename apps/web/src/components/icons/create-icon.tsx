import { IconBase, type IconComponent, type IconNode } from "./icon-base";

export function createIcon(name: string, iconNode: IconNode): IconComponent {
  return (props) => <IconBase {...props} name={name} iconNode={iconNode} />;
}

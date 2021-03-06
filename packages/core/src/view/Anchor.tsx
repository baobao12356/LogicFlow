import { h, Component } from 'preact';
import { createDrag } from '../util/drag';
import { targetNodeInfo, distance } from '../util/node';
import Circle from './basic-shape/Circle';
import Line from './basic-shape/Line';
import { ElementState, EventType } from '../constant/constant';
import BaseNodeModel from '../model/node/BaseNodeModel';
import GraphModel from '../model/GraphModel';
import EventEmitter from '../event/eventEmitter';

interface IProps extends CSSStyleDeclaration {
  x: number,
  y: number,
  active: boolean,
  style: CSSStyleDeclaration,
  hoverStyle: CSSStyleDeclaration,
  edgeStyle: CSSStyleDeclaration,
  anchorIndex: number,
  activeAnchor: number,
  eventCenter: EventEmitter,
  graphModel: GraphModel,
  nodeModel: BaseNodeModel,
  nodeDraging: boolean,
}

interface IState {
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  hover: boolean,
}

class Anchor extends Component<IProps, IState> {
  preTargetNode: BaseNodeModel;
  dragHandler: Function;
  constructor() {
    super();

    this.state = {
      startX: 0,
      startY: 0,
      endX: 0,
      endY: 0,
      hover: false,
    };

    this.dragHandler = createDrag({
      onDragStart: this.onDragStart,
      onDraging: this.onDraging,
      onDragEnd: this.onDragEnd,
    });
  }
  onDragStart = () => {
    const {
      x, y, nodeModel, graphModel,
    } = this.props;
    // nodeModel.setSelected(true);
    graphModel.toFront(nodeModel.id);
    this.setState({
      startX: x,
      startY: y,
      endX: x,
      endY: y,
    });
  };
  onDraging = ({ deltaX, deltaY }) => {
    const { endX, endY } = this.state;
    const { graphModel, nodeModel } = this.props;
    const { transformMatrix, nodes } = graphModel;
    const [x, y] = transformMatrix.moveCanvasPointByHtml(
      [endX, endY],
      deltaX,
      deltaY,
    );
    this.setState({
      endX: x,
      endY: y,
    });
    const info = targetNodeInfo({ x: endX, y: endY }, nodes);
    if (info) {
      const targetNode = info.node;
      this.preTargetNode = targetNode;
      const { isAllPass: isSourcePass } = nodeModel.isAllowConnectedAsSource(targetNode);
      const { isAllPass: isTargetPass } = targetNode.isAllowConnectedAsTarget(nodeModel);
      // 实时提示出即将链接的锚点
      if (isSourcePass && isTargetPass) {
        targetNode.setElementState(ElementState.ALLOW_CONNECT);
        targetNode.setAnchorActive(info.anchorIndex);
      } else {
        targetNode.setElementState(ElementState.NOT_ALLOW_CONNECT);
        this.preTargetNode.setAnchorActive(-1);
      }
    } else if (this.preTargetNode && this.preTargetNode.state !== ElementState.DEFAULT) {
      // 为了保证鼠标离开的时候，将上一个节点状态重置为正常状态。
      this.preTargetNode.setElementState(ElementState.DEFAULT);
      this.preTargetNode.setAnchorActive(-1);
    }
  };
  onDragEnd = () => {
    this.checkEnd();
    this.setState({
      startX: 0,
      startY: 0,
      endX: 0,
      endY: 0,
    });
  };

  setHover(isHover: boolean): void {
    const { nodeDraging } = this.props;
    // 节点拖拽过程中不更新锚点状态
    // 防止拖拽过快导致触发不了节点的onMouseLeave事件，从而导致出现多个锚点被选中的效果
    if (!nodeDraging) {
      this.setState({ hover: isHover });
    }
  }

  checkEnd = () => {
    const {
      graphModel, nodeModel, x, y, eventCenter,
    } = this.props;
    // nodeModel.setSelected(false);
    /* 创建连线 */
    const { nodes, edgeType } = graphModel;
    const { endX, endY } = this.state;
    const info = targetNodeInfo({ x: endX, y: endY }, nodes);
    // 为了保证鼠标离开的时候，将上一个节点状态重置为正常状态。
    if (this.preTargetNode && this.preTargetNode.state !== ElementState.DEFAULT) {
      this.preTargetNode.setElementState(ElementState.DEFAULT);
      this.preTargetNode.setAnchorActive(-1);
    }
    if (info) {
      const targetNode = info.node;
      const {
        isAllPass: isSourcePass,
        msg: sourceMsg,
      } = nodeModel.isAllowConnectedAsSource(targetNode);
      const {
        isAllPass: isTargetPass,
        msg: targetMsg,
      } = targetNode.isAllowConnectedAsTarget(nodeModel);
      if (isSourcePass && isTargetPass) {
        targetNode.setElementState(ElementState.ALLOW_CONNECT);
        // 不允许锚点自己连自己
        if (!(x === info.anchorPosition.x && y === info.anchorPosition.y)) {
          graphModel.createEdge({
            type: edgeType,
            sourceNodeId: nodeModel.id,
            startPoint: { x, y },
            targetNodeId: info.node.id,
            endPoint: { x: info.anchorPosition.x, y: info.anchorPosition.y },
          });
        }
      } else {
        const nodeData = targetNode.getData();
        eventCenter.emit(EventType.CONNECTION_NOT_ALLOWED, {
          data: nodeData,
          msg: targetMsg || sourceMsg,
        });
      }
    }
  };
  isShowLine() {
    const {
      startX,
      startY,
      endX,
      endY,
    } = this.state;
    const v = distance(startX, startY, endX, endY);
    return v > 10;
  }
  render() {
    const {
      startX,
      startY,
      endX,
      endY,
      hover,
    } = this.state;
    const {
      x, y, anchorIndex, activeAnchor, style, edgeStyle, hoverStyle,
    } = this.props;
    return (
      // className="lf-anchor" 作为下载时，需要将锚点删除的依据，不要修改，svg结构也不要做修改否则会引起下载bug
      <g className="lf-anchor">
        {hover || activeAnchor === anchorIndex ? (
          <Circle
            className="lf-node-anchor-hover"
            {...{ x, y }}
            {...hoverStyle}
          />
        ) : ''}
        <Circle
          className="lf-node-anchor"
          {...{ x, y }}
          {...style}
          onMouseEnter={() => this.setHover(true)}
          onMouseLeave={() => this.setHover(false)}
          onMouseDown={this.dragHandler}
        />
        {this.isShowLine() && (
          <Line
            x1={startX}
            y1={startY}
            x2={endX}
            y2={endY}
            pointer-events="none"
            {...edgeStyle}
          />
        )}
      </g>
    );
  }
}

export default Anchor;
